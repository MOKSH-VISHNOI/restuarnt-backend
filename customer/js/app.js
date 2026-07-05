// ==========================================
// YATHARTH CUSTOMER APP
// ==========================================

// DOM
const comboCard =
    document.getElementById(
        "comboCard"
    );

const comboImages =
    document.getElementById(
        "comboImages"
    );
    
const menuList =
    document.getElementById(
        "menuList"
    );

const recommendationSection =
    document.getElementById(
        "recommendationSection"
    );

const recommendationList =
    document.getElementById(
        "recommendationList"
    );

const comboControl =
    document.getElementById(
        "comboControl"
    );



// ==========================================
// MENU DATA
// ==========================================

// Temporary

// Later fetched from backend

let menu = [];
let comboItem = null;


// ==========================================
// INIT
// ==========================================

function init(){

    loadMenu();

}

document.addEventListener(

    "DOMContentLoaded",

    init

);

// ==========================================
// LOAD MENU
// ==========================================

async function loadMenu(){

    try{

        menu = await getMenu();

        comboItem = menu.find(

            item => item.name.includes("Combo")
        
        );

        menu.sort(

            (a,b)=>a.id-b.id
        
        );

        renderMenu();
        refreshComboControl();

    }

    catch(error){

        console.error(error);

    }

}



// renderMenu()

function renderMenu(){

    menuList.innerHTML="";

    menu
    .filter(item => !item.name.includes("Combo"))
    .forEach((item,index)=>{

        menuList.appendChild(

            createMenuCard(

                item,

                index

            )

        );

    });
    
    document
    
        .querySelectorAll(".stagger")
    
        .forEach(
    
            (card,index)=>{
    
                setTimeout(()=>{
    
                    card.classList.add(
    
                        "show"
    
                    );
    
                },index*CONFIG.staggerDelay);
    
            }
    
        );
    
    }

// createMenuCard()

function createMenuCard(

    item,

    index

){

    const card =

        document.createElement(
            "article"
        );

    card.className =
        "menu-card stagger";

    card.innerHTML = `

        <div class="menu-image">

            <img

                src="/images/${item.imageUrl}"

                alt="${item.name}"

                class="food-image"

                onerror="this.src='/images/placeholder.png'"

            >

        </div>

        <div class="menu-info">

            <h3>

                ${item.name}

            </h3>

            <div class="menu-price">

                ₹${item.price}

            </div>

            <div class="menu-footer">

    <div

        class="menu-cart-control"

        data-id="${item.id}"

    >

        ${renderMenuControl(item)}

    </div>

</div>

        </div>

    `;

    const control =

        card.querySelector(
            ".menu-cart-control"
        );

    bindMenuControl(

        control,

        item

    );

    return card;

}


// ==========================================
// BIND MENU CONTROL
// ==========================================

function bindMenuControl(

    control,

    item

){

    const addButton =

        control.querySelector(
            ".add-btn"
        );

    if(addButton){

        addButton.addEventListener(

            "click",

            () => {

                addToCart(item);

            }

        );

        return;

    }

    const increaseButton =
    control.querySelector(".increase");

    const decreaseButton =
    control.querySelector(".decrease");

    increaseButton?.addEventListener(

        "click",

        () => {

            increaseQuantity(item.id);

        }

    );

    decreaseButton?.addEventListener(

        "click",

        () => {

            decreaseQuantity(item.id);

        }

    );

}


// ==========================================
// REFRESH MENU CONTROLS
// ==========================================

function refreshMenuControls(){

    menu.forEach(item => {

        const control =

            document.querySelector(

                `.menu-cart-control[data-id="${item.id}"]`

            );

        if(!control){

            return;

        }

        control.innerHTML =

            renderMenuControl(item);

        bindMenuControl(

            control,

            item

        );

    });

}


// ==========================================
// REFRESH COMBO CONTROL
// ==========================================

function refreshComboControl(){

    if(!comboItem){

        comboControl.innerHTML = "";

        return;

    }

    comboImages.innerHTML =

        renderComboImages();

    comboControl.innerHTML =

        renderComboControl(comboItem);

    bindComboControl(

        comboControl,

        comboItem

    );

    comboCard?.classList.toggle(

        "has-items",

        !!findItem(comboItem.id)

    );

}


// ==========================================
// COMBO CONTROL
// ==========================================

function renderComboControl(item){

    const cartItem =

        findItem(item.id);

    if(!cartItem){

        return `

            <button

                class="primary-btn combo-add-btn ripple"

            >

                Add Combo

            </button>

        `;

    }

    return `

        <div class="quantity">

            <button

                class="decrease"

            >

                −

            </button>

            <span

                class="quantity-value"

            >

                ${cartItem.quantity}

            </span>

            <button

                class="increase"

            >

                +

            </button>

        </div>

    `;

}
// ==========================================
// BIND COMBO CONTROL
// ==========================================

function bindComboControl(

    control,

    item

){
    const comboImages = document.getElementById("comboImages");

if(comboImages){

    comboImages.innerHTML =

        renderComboImages(comboItem);

}

    const addButton =

        control.querySelector(

            ".combo-add-btn"

        );

    if(addButton){

        addButton.addEventListener(

            "click",

            ()=>{

                addToCart(item);

            }

        );

        return;

    }

    control.querySelector(".increase")

        ?.addEventListener(

            "click",

            ()=>increaseQuantity(item.id)

        );

    control.querySelector(".decrease")

        ?.addEventListener(

            "click",

            ()=>decreaseQuantity(item.id)

        );

}


// ==========================================
// COMBO IMAGES
// ==========================================

function renderComboImages(){

    return `

        <img

            src="/images/sandwich.png"

            alt="Sandwich"

        >

        <span>

            +

        </span>

        <img

            src="/images/cold_coffee.png"

            alt="Cold Coffee"

        >

    `;

}

// ==========================================
// MENU CONTROL
// ==========================================

function renderMenuControl(item){

    const cartItem =

        findItem(item.id);

    if(!cartItem){

        return `

            <button

                class="add-btn ripple"

            >

                Add

            </button>

        `;

    }

    return `

        <div class="quantity">

    <button class="decrease">

        −

    </button>

    <span class="quantity-value">

        ${cartItem.quantity}

    </span>

    <button class="increase">

        +

    </button>

</div>

    `;

}   
