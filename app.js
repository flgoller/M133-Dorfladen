'use strict';
import {Application, Router, renderFileToString} from "./deps.js";

const cwdtmp = import.meta.url.replace("file://" + Deno.cwd() + "/", "");
const cwd = cwdtmp.replace("/app.js", "");

let shoppingList = [
    {id:0, name:"Tomate", price: "5 CHF", bild: cwd + "/products/tomaten.jpg"},
    {id:1, name:"Eier", price: "2 CHF", bild: cwd + "/products/eier.jpg"},
    {id:2, name:"Senf", price: "4 CHF", bild: cwd + "/products/senf.jpg"}
];

const app = new Application();
const router = new Router();


let counter = 3;

router.get("/", async (ctx) => {
    ctx.response.body = await renderFileToString(Deno.cwd() + "/index.ejs", {
        title:"Produkte",
        products: shoppingList
    });
});

router.get('/product/:id', async (ctx) => {
    const productId = ctx.params.id;
    ctx.response.body = await renderFileToString(Deno.cwd() + "/detail.ejs", {
        product: shoppingList[productId]
    });
});


router.post("/addProduct", async (ctx) => {

    let formContent = await ctx.request.body({type:'form'}).value; // Input vom Formular wird übergeben
    let nameValue = formContent.get("newProductName"); // newProductName wird ausgelesen

    console.log("Ein addProduct post request erhalten für: " + nameValue);

    if(nameValue){
        shoppingList.push(
            {id:counter++, name:nameValue} // Nimmt die nächsthöhere Nummer
        );
    }

    ctx.response.redirect("/"); // Zur Startseite weiterführen
});

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener('listen', () => {
    console.log("Server läuft");
});

await app.listen({port:8000});