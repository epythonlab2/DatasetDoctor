export const About = {
    show: async () => {
        const modal = document.getElementById('aboutModal');
        const placeholder = document.getElementById('about-content-placeholder');
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            const response = await fetch('about.html');
            const html = await response.text();
            placeholder.innerHTML = html;
            if (window.lucide) window.lucide.createIcons();
        } catch (error) {
            console.error("About Error:", error);
        }
    },
    close: () => {
        const modal = document.getElementById('aboutModal');
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
};

// ADD THIS LINE: Explicitly expose it to the HTML
window.About = About;
