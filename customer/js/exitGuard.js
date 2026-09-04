// ==========================================
// YATHARTH EXIT GUARD
// ==========================================

const exitConfirmOverlay =
    document.getElementById("exitConfirmOverlay");

const stayButton =
    document.getElementById("stayButton");

const leaveButton =
    document.getElementById("leaveButton");


if(
    !exitConfirmOverlay ||
    !stayButton ||
    !leaveButton
){
    console.warn(
        "Yatharth Exit Guard: required elements not found."
    );
}
else{

    // ==========================================
    // HISTORY GUARD
    // ==========================================

    history.pushState(
        {
            yatharthGuard: true
        },
        "",
        window.location.href
    );


    let leavingPage = false;


    // ==========================================
    // SHOW CONFIRMATION
    // ==========================================

    function showExitConfirmation(){

        exitConfirmOverlay.classList.remove(
            "hidden"
        );

        exitConfirmOverlay.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "exit-confirm-open"
        );

    }


    // ==========================================
    // HIDE CONFIRMATION
    // ==========================================

    function hideExitConfirmation(){

        exitConfirmOverlay.classList.add(
            "hidden"
        );

        exitConfirmOverlay.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "exit-confirm-open"
        );

    }


    // ==========================================
    // BACK / SWIPE
    // ==========================================

    window.addEventListener(
        "popstate",
        (event) => {

            // Intentional Leave action
            if(leavingPage){
                return;
            }


            /*
             * If we arrived at the guard state,
             * another existing system is handling
             * the navigation.
             *
             * Examples:
             * Search → Menu
             * Review → Cart
             * Cart → Menu
             */
            if(
                event.state?.yatharthGuard === true
            ){
                return;
            }


            /*
             * Any other state belongs to an
             * internal Yatharth UI flow.
             *
             * Let cart.js / checkout.js / search.js
             * handle it.
             */
            if(event.state?.yatharthModal){
                return;
            }

            if(event.state?.searchActive){
                return;
            }


            /*
             * We have reached the page underneath
             * our guard.
             *
             * Put the guard back immediately so
             * the user remains on this page while
             * the confirmation is displayed.
             */

            history.pushState(
                {
                    yatharthGuard: true
                },
                "",
                window.location.href
            );


            showExitConfirmation();

        }
    );


    // ==========================================
    // STAY
    // ==========================================

    stayButton.addEventListener(
        "click",
        () => {

            hideExitConfirmation();

        }
    );


    // ==========================================
    // LEAVE
    // ==========================================
    leaveButton.addEventListener(
        "click",
        () => {
    
            if (leavingPage) {
                return;
            }
    
            leavingPage = true;
    
            hideExitConfirmation();
    
            /*
             * End the current ordering session.
             * Clear the saved cart so the next
             * QR scan starts with a fresh order.
             */
    
            localStorage.removeItem(
                CONFIG.cartStorageKey
            );
    
            document.body.classList.add(
                "yatharth-exiting"
            );
    
            setTimeout(() => {
    
                history.go(-2);
    
            }, 280);
    
        }
    );


    // ==========================================
    // OVERLAY CLICK
    // ==========================================

    exitConfirmOverlay.addEventListener(
        "click",
        (event) => {

            if(
                event.target ===
                exitConfirmOverlay
            ){

                hideExitConfirmation();

            }

        }
    );


    // ==========================================
    // ESCAPE
    // ==========================================

    document.addEventListener(
        "keydown",
        (event) => {

            if(
                event.key === "Escape" &&
                !exitConfirmOverlay.classList.contains(
                    "hidden"
                )
            ){

                hideExitConfirmation();

            }

        }
    );

}