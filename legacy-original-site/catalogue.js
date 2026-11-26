/* =========================================================
   NORVEX WEBSITE
   SEARCH, FILTER & SUPPLY BASKET
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       ELEMENT REFERENCES
    ===================================================== */

    const searchInput = document.getElementById("productSearch");
    const searchButton = document.getElementById("searchButton");
    const noResults = document.getElementById("noResults");

    const productCards =
        document.querySelectorAll(".catalogue-product");

    const categoryButtons =
        document.querySelectorAll(".catalogue-filter");

    const categorySections =
        document.querySelectorAll(".catalogue-category");

    const basketItemsContainer =
        document.getElementById("basketItems");

    const addButtons =
        document.querySelectorAll(".add-basket");

    const basketCount =
        document.getElementById("basketCount");

    let activeCategory = "all";


    /* =====================================================
       BASKET STORAGE
    ===================================================== */

    function getBasket() {

        try {

            const savedBasket =
                localStorage.getItem("norvexBasket");

            if (!savedBasket) {
                return [];
            }

            const basket =
                JSON.parse(savedBasket);

            return Array.isArray(basket)
                ? basket
                : [];

        } catch (error) {

            console.error(
                "Could not read basket:",
                error
            );

            return [];

        }

    }


    function saveBasket(basket) {

        localStorage.setItem(
            "norvexBasket",
            JSON.stringify(basket)
        );

    }


    /* =====================================================
       UPDATE BASKET NUMBER
    ===================================================== */

    function updateBasketCount() {

        const basket =
            getBasket();

        const count =
            basket.length;


        /* Main basket count */

        const basketCountElements =
            document.querySelectorAll(
                "#basketCount"
            );


        basketCountElements.forEach(function (element) {

            element.textContent =
                count;

        });


        /* Older basket count ID if it exists */

        const oldCount =
            document.getElementById(
                "catalogueBasketCount"
            );

        if (oldCount) {

            oldCount.textContent =
                count;

        }

    }


    /* =====================================================
       RENDER SUPPLY BASKET
    ===================================================== */

    function renderBasket() {

        if (!basketItemsContainer) {

            updateBasketCount();

            return;

        }


        const basket =
            getBasket();


        if (basket.length === 0) {

            basketItemsContainer.innerHTML =
                '<p class="basket-empty">' +
                'Your supply basket is currently empty.' +
                '</p>';

            updateBasketCount();

            return;

        }


        let html = "";


        basket.forEach(function (item, index) {

            html += `

                <div class="basket-item">

                    <div class="basket-item-details">

                        <span class="basket-item-name">
                            ${item.name}
                        </span>

                        <span class="basket-item-category">
                            ${item.category}
                        </span>

                    </div>

                    <button
                        type="button"
                        class="basket-remove"
                        data-index="${index}"
                    >
                        Remove
                    </button>

                </div>

            `;

        });


        basketItemsContainer.innerHTML =
            html;


        /* REMOVE BUTTONS */

        const removeButtons =
            basketItemsContainer.querySelectorAll(
                ".basket-remove"
            );


        removeButtons.forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const index =
                        parseInt(
                            button.dataset.index,
                            10
                        );


                    const currentBasket =
                        getBasket();


                    currentBasket.splice(
                        index,
                        1
                    );


                    saveBasket(
                        currentBasket
                    );


                    renderBasket();

                }
            );

        });


        updateBasketCount();

    }


    /* =====================================================
       ADD PRODUCT TO BASKET
    ===================================================== */

    addButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                const card =
                    button.closest(
                        ".catalogue-product"
                    );


                if (!card) {
                    return;
                }


                const nameElement =
                    card.querySelector("h3");


                const productName =
                    nameElement
                        ? nameElement.textContent.trim()
                        : "Product";


                const category =
                    card.dataset.category ||
                    "General";


                let basket =
                    getBasket();


                /* Check if already added */

                const alreadyExists =
                    basket.some(function (item) {

                        return item.name ===
                            productName;

                    });


                if (!alreadyExists) {

                    basket.push({

                        name: productName,

                        category: category

                    });


                    saveBasket(
                        basket
                    );

                }


                /* Button feedback */

                const originalText =
                    button.textContent;


                button.textContent =
                    alreadyExists
                        ? "Already Added ✓"
                        : "Added ✓";


                button.classList.add(
                    "added"
                );


                /* Update count immediately */

                updateBasketCount();


                /* Update basket if it exists */

                renderBasket();


                setTimeout(
                    function () {

                        button.textContent =
                            originalText;

                        button.classList.remove(
                            "added"
                        );

                    },
                    1500
                );

            }
        );

    });


    /* =====================================================
       SEARCH PRODUCTS
    ===================================================== */

    function filterProducts() {

        const searchTerm =
            searchInput
                ? searchInput.value
                    .toLowerCase()
                    .trim()
                : "";


        let visibleProducts = 0;


        productCards.forEach(
            function (card) {

                const productName =
                    (
                        card.dataset.product ||
                        ""
                    ).toLowerCase();


                const productCategory =
                    (
                        card.dataset.category ||
                        ""
                    ).toLowerCase();


                const productText =
                    card.textContent.toLowerCase();


                const matchesSearch =

                    searchTerm === "" ||

                    productName.includes(
                        searchTerm
                    ) ||

                    productText.includes(
                        searchTerm
                    );


                const matchesCategory =

                    activeCategory ===
                        "all" ||

                    productCategory ===
                        activeCategory;


                if (
                    matchesSearch &&
                    matchesCategory
                ) {

                    card.style.display =
                        "";

                    visibleProducts++;

                } else {

                    card.style.display =
                        "none";

                }

            }
        );


        /* CATEGORY SECTIONS */

        categorySections.forEach(
            function (section) {

                const sectionCategory =
                    section.dataset
                        .categorySection;


                const cards =
                    section.querySelectorAll(
                        ".catalogue-product"
                    );


                let hasVisibleProduct =
                    false;


                cards.forEach(
                    function (card) {

                        if (
                            card.style.display !==
                            "none"
                        ) {

                            hasVisibleProduct =
                                true;

                        }

                    }
                );


                if (
                    hasVisibleProduct &&
                    (
                        activeCategory ===
                            "all" ||

                        activeCategory ===
                            sectionCategory
                    )
                ) {

                    section.style.display =
                        "";

                } else {

                    section.style.display =
                        "none";

                }

            }
        );


        /* NO RESULTS */

        if (noResults) {

            noResults.style.display =
                visibleProducts === 0
                    ? "block"
                    : "none";

        }

    }


    /* =====================================================
       SEARCH BUTTON
    ===================================================== */

    if (searchButton) {

        searchButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                filterProducts();

            }
        );

    }


    /* SEARCH WHILE TYPING */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                filterProducts();

            }
        );


        /* ENTER KEY */

        searchInput.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    filterProducts();

                }

            }
        );

    }


    /* =====================================================
       CATEGORY BUTTONS
    ===================================================== */

    categoryButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    activeCategory =
                        button.dataset.category ||
                        "all";


                    categoryButtons.forEach(
                        function (btn) {

                            btn.classList.remove(
                                "active"
                            );

                        }
                    );


                    button.classList.add(
                        "active"
                    );


                    filterProducts();

                }
            );

        }
    );


    /* =====================================================
       INITIALISE EVERYTHING
    ===================================================== */

    updateBasketCount();

    renderBasket();

    filterProducts();

});