'use strict';
import { Application, Router, renderFileToString, send } from "./deps.js";
import { viewEngine, engineFactory, adapterFactory } from "https://deno.land/x/view_engine/mod.ts";
import { readJson } from 'https://deno.land/x/jsonfile/mod.ts';
import { Session } from "https://deno.land/x/oak_sessions/mod.ts";
import { validate, required, isEmail, isNumeric, firstMessages } from "https://deno.land/x/validasaur@v0.15.0/mod.ts";

const ejsEngine = await engineFactory.getEjsEngine();
const oakAdapter = await adapterFactory.getOakAdapter();

class cartitem {
    product;
    amount = 1;
    price() {
        return this.product.specialOffer * this.amount
    };
    constructor(product) {
        this.product = product;
    }
}

async function getCartPrice(cart) {
    let cartPrice = 0;
    if (cart) {
        cart.forEach(element => {
            cartPrice += element.price();
        });
    }
    return cartPrice;
}

let products = await readJson('static/products/products.json')

const app = new Application();

// Session konfigurieren und starten
const session = new Session();
const router = new Router();

app.use(session.initMiddleware())

router.get("/", async (ctx) => {
    let cart = await ctx.state.session.get("cart");
    const cartPrice = await getCartPrice(cart);
    ctx.response.body = await renderFileToString(Deno.cwd() + "/index.ejs", {
        title: "Produkte",
        products: products,
        cartPrice: cartPrice
    });
});
router.get('/product/:id', async (ctx) => {
    const productId = ctx.params.id;
    let cart = await ctx.state.session.get("cart");
    const cartPrice = await getCartPrice(cart);
    ctx.response.body = await renderFileToString(Deno.cwd() + "/detail.ejs", {
        product: products.find(product => product.id == productId),
        title: products.find(product => product.id == productId).productName,
        cartPrice: cartPrice
    });
});
router.get("/product/:id/add", async (ctx) => {
    const productId = ctx.params.id;
    if (!await ctx.state.session.has("cart")) {
        await ctx.state.session.set("cart", []);
    }

    let cart = await ctx.state.session.get("cart");
    let product = products.find(product => product.id == productId);
    if (cart.find(x => x.product.id === product.id)) {
        cart.find(x => x.product.id === product.id).amount++;
    }
    else {
        cart = [...cart, new cartitem(product)]
    }
    await ctx.state.session.set("cart", cart);

    ctx.response.redirect("/");
})
router.get("/product/:id/add/cart", async (ctx) => {
    const productId = ctx.params.id;
    if (!await ctx.state.session.has("cart")) {
        await ctx.state.session.set("cart", []);
    }

    let cart = await ctx.state.session.get("cart");
    let product = products.find(product => product.id == productId);
    if (cart.find(x => x.product.id === product.id)) {
        cart.find(x => x.product.id === product.id).amount++;
    }
    else {
        cart = [...cart, new cartitem(product)]
    }
    await ctx.state.session.set("cart", cart);

    ctx.response.redirect("/cart");
})
router.get("/product/:id/remove/cart", async (ctx) => {
    const productId = ctx.params.id;
    if (!await ctx.state.session.has("cart")) {
        await ctx.state.session.set("cart", []);
    }

    let cart = await ctx.state.session.get("cart");
    let product = products.find(product => product.id == productId);
    if (cart.find(x => x.product.id === product.id)) {
        if (cart.find(x => x.product.id === product.id).amount > 1) {
            cart.find(x => x.product.id === product.id).amount--;
        }
        else {
            cart = cart.filter(x => x.product.id != productId)
        }
    }
    else {
        cart = [...cart, new cartitem(product)]
    }
    await ctx.state.session.set("cart", cart);

    ctx.response.redirect("/cart");
})
router.get('/cart', async (ctx) => {
    let cart = await ctx.state.session.get("cart");
    const cartPrice = await getCartPrice(cart);
    ctx.response.body = await renderFileToString(Deno.cwd() + "/cart.ejs", {
        title: "Warenkorb",
        cartitems: await ctx.state.session.get("cart"),
        cartPrice: cartPrice
    });
});
router.get('/cart/item/:id/remove', async (ctx) => {
    let cart = await ctx.state.session.get("cart");
    const productId = ctx.params.id;

    cart = cart.filter(x => x.product.id != productId)
    await ctx.state.session.set("cart", cart)

    ctx.response.redirect("/cart");
});
router.get('/checkout', async (ctx) => {
    const cart = await ctx.state.session.get("cart");
    const cartPrice = await getCartPrice(cart);
    if (cartPrice > 0) {
        ctx.response.body = await renderFileToString(Deno.cwd() + "/checkout.ejs", {
            title: "Checkout",
            cartitems: cart,
            cartPrice: cartPrice,
            errorMessages: '',
        });
    }
    else {
        ctx.response.redirect("/cart");
    }

});
router.post('/order', async (ctx) => {
    const body = await ctx.request.body().value;
    if (body) {
        const inputs = Object.fromEntries(body);
        const [passes, errors] = await validate(inputs, {
            prename: [required],
            name: [required],
            email: [required, isEmail],
        });
        if (passes) {
            let orderDetails = JSON.stringify(inputs)
            console.log(orderDetails)
            ctx.state.session.set("orderDetails", JSON.parse(orderDetails));
            ctx.response.redirect("/orderDetails");
        }
        else {
            const firstErrors = firstMessages(errors);
            const errorMessages = Object.values(firstErrors);

            let cart = await ctx.state.session.get("cart");
            const cartPrice = await getCartPrice(cart);
            ctx.response.body = await renderFileToString(Deno.cwd() + "/checkout.ejs", {
                title: "Checkout",
                cartitems: await ctx.state.session.get("cart"),
                cartPrice: cartPrice,
                errorMessages: errorMessages
            });
        }
    }
    else {
        console.log("No form submission");
        ctx.response.redirect("/checkout");
    }
});
router.get('/orderDetails', async (ctx) => {
    let cart = await ctx.state.session.get("cart");
    let orderDetails = await ctx.state.session.get("orderDetails");
    console.log(orderDetails)
    const cartPrice = await getCartPrice(cart);
    ctx.response.body = await renderFileToString(Deno.cwd() + "/orderDetails.ejs", {
        title: "Order",
        cartitems: cart,
        cartPrice: cartPrice,
        orderDetails: orderDetails
    });
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