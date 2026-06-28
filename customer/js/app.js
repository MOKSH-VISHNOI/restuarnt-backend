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

const menu = [

    {

        id:1,

        name:"Sandwich",

        price:80,

        image:"./images/sandwich.png",

        readyTime:"~3 mins"

    },

    {

        id:2,

        name:"Cold Coffee",

        price:60,

        image:"./images/coffee.png",

        readyTime:"~2 mins"

    },

    {

        id:3,

        name:"Water Bottle",

        price:20,

        image:"./images/water.png",

        readyTime:"Instant"

    }

];



// ==========================================
// INIT
// ==========================================

function init(){

    renderMenu();

}

document.addEventListener(

    "DOMContentLoaded",

    init

);

// renderMenu()

function renderMenu(){

    menuList.innerHTML="";

    menu.forEach(

        (item,index)=>{

            menuList.appendChild(

                createMenuCard(

                    item,

                    index

                )

            );

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
        `${index*60}ms`;

    card.innerHTML =

    `

    <div class="menu-image">

        <img

            src="${item.image}"

            alt="${item.name}"

            class="food-image"

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

                ${item.readyTime}

            </span>

            <button

                class="add-btn ripple"

                data-id="${item.id}"

            >

                Add

            </button>

        </div>

    </div>

    `;

    return card;

}