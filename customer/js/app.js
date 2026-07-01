// ==========================================
// YATHARTH CUSTOMER APP
// ==========================================

// DOM

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



// ==========================================
// MENU DATA
// ==========================================

// Temporary

// Later fetched from backend

let menu = [];


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


// =====================
// LOAD MENU
// =====================

// ==========================================
// LOAD MENU
// ==========================================

async function loadMenu(){

    try{

        menu = await getMenu();

        menu.sort((a,b)=>{

            if(
                a.name.includes("Combo")
            ) return -1;

            if(
                b.name.includes("Combo")
            ) return 1;

            return a.id-b.id;

        });

        renderMenu();

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

    card.style.animationDelay =
        `${index * 60}ms`;

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

                <span class="ready-chip">

                    ${
                        item.preparationTime === 0
                            ? "⚡ Ready Now"
                            : `🕒 Ready in ${item.preparationTime} min`
                    }

                </span>

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