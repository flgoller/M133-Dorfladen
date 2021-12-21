'use strict';
import { Application, Router, renderFileToString, send } from "./deps.js";
import { viewEngine, engineFactory, adapterFactory } from "https://deno.land/x/view_engine/mod.ts";
import { readJson } from 'https://deno.land/x/jsonfile/mod.ts';
import { Session } from "https://deno.land/x/session@1.1.0/mod.ts";

const ejsEngine = await engineFactory.getEjsEngine();
const oakAdapter = await adapterFactory.getOakAdapter();

class cartitem{
    product;
    amount = 1;
    price = () => {
        return this.product.normalPrice * this.amount
    };
    constructor(product){
        this.product = product;
    }
}

let products = await readJson('static/products/products.json')

const app = new Application();

// Configuring Session for the Oak framework
const session = new Session({ framework: "oak" });
await session.init();

// Adding the Session middleware. Now every context will include a property
// called session that you can use the get and set functions on
app.use(session.use()(session));

const router = new Router();

router.get("/", async (ctx) => {
    ctx.response.body = await renderFileToString(Deno.cwd() + "/index.ejs", {
        title: "Produkte",
        products: products
    });
});
router.get('/product/:id', async (ctx) => {
    const productId = ctx.params.id;
    ctx.response.body = await renderFileToString(Deno.cwd() + "/detail.ejs", {
        product: products.find(item => item.id == productId),
        title: products.find(item => item.id == productId).productName
    });
});
router.get("/product/:id/add", async (ctx) =>{
    const productId = ctx.params.id;
    if (await ctx.state.session.get("cart") === undefined) {
        await ctx.state.session.set("cart", []);
        console.log("miese zeiten")
    }
    await ctx.state.session.set("cart", [...(await ctx.state.session.get("cart")), new cartitem(products.find(product => product.id == productId))]);

    console.log(await ctx.state.session.get("cart"))
    ctx.response.redirect("/");
})
router.get('/cart', async (ctx) => {
    console.log(await ctx.state.session.get("cart"))
    ctx.response.body = await renderFileToString(Deno.cwd() + "/cart.ejs", {
        title: "Warenkorb",
        cartitems: await ctx.state.session.get("cart")
    });
});

router.post("/addProduct", async (ctx) => {

    let formContent = await ctx.request.body({ type: 'form' }).value; // Input vom Formular wird übergeben
    let nameValue = formContent.get("newProductName"); // newProductName wird ausgelesen

    console.log("Ein addProduct post request erhalten für: " + nameValue);

    if (nameValue) {
        products.push(
            { id: counter++, name: nameValue } // Nimmt die nächsthöhere Nummer
        );
    }

    ctx.response.redirect("/"); // Zur Startseite weiterführen
});

app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (context) => {
    await send(context, context.request.url.pathname, {
        root: `${Deno.cwd()}/static`
    });
});
app.use(viewEngine(oakAdapter, ejsEngine));


app.addEventListener('listen', () => {
    console.log("Server läuft");
});

await app.listen({ port: 8000 });