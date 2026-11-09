// Mermaid : rendu manuel pour éviter les conflits de chargement
async function renderMermaid() {
    if (typeof mermaid === 'undefined') return;
    mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: { htmlLabels: true },
        sequence: { htmlLabels: true }
    });
    try {
        await mermaid.run({
            nodes: document.querySelectorAll('pre.mermaid')
        });
    } catch (e) {
        // En cas d'erreur sur un bloc, on log mais on continue
        console.warn('Mermaid render error:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMermaid);
} else {
    renderMermaid();
}

// Smooth scroll for nav links + active state
const sections = document.querySelectorAll('.section[id]');
const navLinks = document.querySelectorAll('.nav-link');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            const offset = 20;
            const targetPos = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: targetPos, behavior: 'smooth' });
        }
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    });
});

// Highlight active section on scroll
window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
}, { passive: true });
