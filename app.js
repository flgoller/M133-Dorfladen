'use strict';
import { Application, Router, renderFileToString, send } from "./deps.js";
import { viewEngine, engineFactory, adapterFactory } from "https://deno.land/x/view_engine/mod.ts";
import { readJson } from 'https://deno.land/x/jsonfile/mod.ts';
import { Session } from "https://deno.land/x/oak_sessions/mod.ts";

const ejsEngine = await engineFactory.getEjsEngine();
const oakAdapter = await adapterFactory.getOakAdapter();

class cartitem{
    product;
    amount = 1;
    price() {
        return this.product.specialOffer * this.amount
    };
    constructor(product){
        this.product = product;
    }
}

let products = await readJson('static/products/products.json')

const app = new Application();

// Session konfigurieren und starten
const session = new Session();
const router = new Router();

app.use(session.initMiddleware())

router.get("/", async (ctx) => {
    ctx.response.body = await renderFileToString(Deno.cwd() + "/index.ejs", {
        title: "Produkte",
        products: products
    });
});
router.get('/product/:id', async (ctx) => {
    const productId = ctx.params.id;
    ctx.response.body = await renderFileToString(Deno.cwd() + "/detail.ejs", {
        product: products.find(product => product.id == productId),
        title: products.find(product => product.id == productId).productName
    });
});
router.get("/product/:id/add", async (ctx) =>{
    const productId = ctx.params.id;
    if (!await ctx.state.session.has("cart")) {
        await ctx.state.session.set("cart", []);
    }

    let cart = await ctx.state.session.get("cart");
    let product = products.find(product => product.id == productId);
    if(cart.find(x => x.product.id === product.id)){
        cart.find(x => x.product.id === product.id).amount++;
    }
    else
    {
        cart = [...cart, new cartitem(product)]
    }
    await ctx.state.session.set("cart", cart);

    ctx.response.redirect("/");
})
router.get('/cart', async (ctx) => {
    ctx.response.body = await renderFileToString(Deno.cwd() + "/cart.ejs", {
        title: "Warenkorb",
        cartitems: await ctx.state.session.get("cart")
    });
});
router.get('/cart/item/:id/remove', async (ctx) => {
    debugger;
    let cart = await ctx.state.session.get("cart");
    const productId = ctx.params.id;

    cart = cart.filter(x => x.product.id != productId)
    await ctx.state.session.set("cart", cart)

    ctx.response.redirect("/cart");
});

app.use(viewEngine(oakAdapter, ejsEngine));
app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (context) => {
    await send(context, context.request.url.pathname, {
        root: `${Deno.cwd()}/static`
    });
});



app.addEventListener('listen', () => {
    console.log("Server läuft");
});

await app.listen({ port: 8000 });