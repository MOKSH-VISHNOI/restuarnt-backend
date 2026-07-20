// =========================
// THEME
// =========================

const html =
    document.documentElement;

const themeBtn =
    document.getElementById(
        "themeToggle"
    );

const overlay =
    document.getElementById(
        "themeOverlay"
    );

const savedTheme =
    localStorage.getItem(
        CONFIG.themeStorageKey
    );

if(savedTheme){

    html.dataset.theme =
        savedTheme;

}else{

    const prefersDark =
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;

    html.dataset.theme =
        prefersDark
            ? "dark"
            : "light";

}

updateThemeIcon();



// =========================
// TOGGLE
// =========================

if(themeBtn){

    themeBtn.onclick = () => {

        overlay.classList.add(
            "active"
        );

        themeBtn.classList.add(
            "theme-spin"
        );

        const nextTheme =

            html.dataset.theme === "dark"

                ? "light"

                : "dark";

        setTimeout(() => {

            html.dataset.theme =
                nextTheme;

            localStorage.setItem(
                CONFIG.themeStorageKey,
                nextTheme
            );

            updateThemeIcon();

        },120);

        setTimeout(() => {

            overlay.classList.remove(
                "active"
            );

            themeBtn.classList.remove(
                "theme-spin"
            );

        },450);

    };

}

// =========================
// ICON
// =========================

function updateThemeIcon(){

    if(!themeBtn){

        return;

    }

    themeBtn.textContent =

        html.dataset.theme === "dark"

            ? "☀️"

            : "🌙";

}



// =========================
// PHONE THEME CHANGE
// =========================

window.matchMedia(
    "(prefers-color-scheme: dark)"
)

.addEventListener(

    "change",

    e=>{

        if(

            localStorage.getItem(
                "theme"
            )

        ) return;

        html.dataset.theme=

            e.matches

                ? "dark"

                : "light";

        updateThemeIcon();

    }

);



// =========================
// STAGGER ANIMATION
// =========================

window.addEventListener(

    "load",

    ()=>{

        const items=

            document.querySelectorAll(
                ".stagger"
            );

        items.forEach(

            (item,index)=>{

                setTimeout(()=>{

                    item.classList.add(
                        "show"
                    );

                },index*55);

            }

        );

    }

);