function initialiserTheme() {
    const toggleThemeInput = document.getElementById('toggle-theme-mode');
    const themeBadge = document.getElementById('theme-mode-badge');

    console.log("Recherche de l'élément switch...", toggleThemeInput);

    if (!toggleThemeInput) {
        console.error("L'élément #toggle-theme-mode n'existe pas au moment où le JS s'exécute !");
        return;
    }

    // Fonction d'application
    function appliquerTheme(isLight) {
        if (isLight) {
            document.body.classList.add('light-mode');
            if (themeBadge) themeBadge.textContent = 'Clair';
            console.log("Mode CLAIR appliqué sur le body");
        } else {
            document.body.classList.remove('light-mode');
            if (themeBadge) themeBadge.textContent = 'Sombre';
            console.log("Mode SOMBRE appliqué sur le body");
        }
        localStorage.setItem('theme_preference', isLight ? 'light' : 'dark');
    }

    // Charger le thème initial
    const themeSauvegarde = localStorage.getItem('theme_preference') === 'light';
    toggleThemeInput.checked = themeSauvegarde;
    appliquerTheme(themeSauvegarde);

    // Écouter le clic sur le switch
    toggleThemeInput.addEventListener('change', (e) => {
        appliquerTheme(e.target.checked);
    });
}

// Sécurité pour s'assurer que le HTML est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialiserTheme);
} else {
    initialiserTheme();
}