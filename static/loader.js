document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('upload');
    const dropzone = document.getElementById('dropzone');
    const loadingState = document.getElementById('loading-state');

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handleUpload(file);
        }
    });

    async function handleUpload(file) {
        // 1. UI Feedback: Show loading, hide upload
        dropzone.classList.add('hidden');
        loadingState.classList.remove('hidden');

        // 2. Prepare Data
        const formData = new FormData();
        formData.append("file", file);

        try {
            // 3. Actual Upload to your backend
            const response = await fetch("/upload", { 
                method: "POST", 
                body: formData 
            });
            
            if (!response.ok) throw new Error("Upload failed");
            
            const data = await response.json();

            // 4. Persistence: Store the analysis results in localStorage
            // This allows the next page (analysis.html) to access the data
            localStorage.setItem("datasetDoctorResults", JSON.stringify(data));

            // 5. Redirect to the analysis page
            window.location.href = "dashboard.html"; 

        } catch (error) {
            console.error("Error:", error);
            alert("Upload failed. Please try again.");
            
            // Reset UI on error
            dropzone.classList.remove('hidden');
            loadingState.classList.add('hidden');
        }
    }
});