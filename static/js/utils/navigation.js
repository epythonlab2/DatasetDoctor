function openUploader() {
    window.open('/uploader', '_blank', 'noopener,noreferrer');
}
// Finalize: Re-scan DOM for new icons injected by the update functions
 lucide.createIcons(); 

// optional: attach to window if used in HTML onclick
window.openUploader = openUploader;
