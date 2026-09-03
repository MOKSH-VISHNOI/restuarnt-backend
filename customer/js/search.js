// Search functionality for menu

const searchInput = document.getElementById('searchInput');
const searchCloseBtn = document.getElementById('searchCloseBtn');
let _searchDebounce = null;
let _hasSearchState = false;

function escapeHtml(s){
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderFilteredMenu(list, query){
    // reuse createMenuCard from app.js
    menuList.innerHTML = '';

    if(!list || list.length === 0){
        menuList.innerHTML = `<p class="no-results">No results for "${escapeHtml(query)}"</p>`;
        return;
    }

    list.forEach((item, index) => {
        menuList.appendChild(
            createMenuCard(item, index)
        );
    });

    // re-apply stagger show
    document.querySelectorAll('.stagger').forEach((card, idx)=>{
        setTimeout(()=>card.classList.add('show'), idx * (CONFIG?.staggerDelay || 40));
    });
}

function applySearchFilter(query){
    query = String(query || '').trim().toLowerCase();

    if(!query){
        // show full menu
        renderMenu();
        // show recommendations if available
        recommendationSection?.classList?.add('hidden');
        return;
    }

    const filtered = (menu || []).filter(item => {
        const text = (item.name + ' ' + (item.description || '')).toLowerCase();
        return text.indexOf(query) !== -1;
    });

    renderFilteredMenu(filtered, query);
}

function closeSearch(){
    searchInput.value = '';
    searchInput.blur();
    applySearchFilter('');
    _hasSearchState = false;
}

function pushSearchState(){
    if(!_hasSearchState && searchInput.value.trim()){
        history.pushState({searchActive: true}, '', window.location.href);
        _hasSearchState = true;
    }
}

// Handle back button - close search immediately and blur input
window.addEventListener('popstate', (e) => {
    if(_hasSearchState || searchInput.value.trim()){
        closeSearch();
        _hasSearchState = false;
    }
});

if(searchInput){
    searchInput.addEventListener('input', (e) => {
        const q = e.target.value;
        
        // Push search state when user starts typing
        if(q.trim() && !_hasSearchState){
            pushSearchState();
        }
        
        // Remove state if search is cleared
        if(!q.trim()){
            _hasSearchState = false;
        }
        
        if(_searchDebounce) clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(()=> applySearchFilter(q), 180);
    });

    // Close keyboard only when Enter is pressed
    searchInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
            e.preventDefault();
            const first = menuList.querySelector('.menu-card');
            if(first) first.scrollIntoView({behavior:'smooth', block:'start'});
            searchInput.blur();
        }
    });
}

if(searchCloseBtn){
    searchCloseBtn.addEventListener('click', closeSearch);
}
