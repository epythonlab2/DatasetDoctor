/* --- Modern Design Variables --- */
:root {
    --primary: #6366f1;
    --primary-hover: #4f46e5;
    --bg-main: #ffffff;
    --bg-subtle: #f8fafc;
    --border: #e2e8f0;
    --text-main: #1e293b;
    --text-muted: #64748b;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --radius-lg: 12px;
    --radius-xl: 16px;
}

/* --- Section Container --- */
#preview-section {
    max-width: 1000px;
    margin: 2rem auto;
    padding: 0 1rem;
    display: flex;
    flex-direction: column;
}

/* --- The Preview Container --- */
.table-preview-wrapper {
    max-height: 500px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--bg-main);
    box-shadow: var(--shadow-sm);
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
}

/* Custom Scrollbar for Webkit */
.table-preview-wrapper::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.table-preview-wrapper::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 10px;
}

#preview-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-variant-numeric: tabular-nums;
}

#preview-table th {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg-subtle);
    padding: 12px 24px;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(8px); /* Modern frosted effect */
}

#preview-table td {
    padding: 16px 24px;
    font-size: 0.875rem;
    color: var(--text-main);
    border-bottom: 1px solid var(--bg-subtle);
    white-space: nowrap;
    transition: background 0.15s ease;
}

#preview-table tr:last-child td {
    border-bottom: none;
}

#preview-table tr:hover td {
    background: #f1f5f9;
}

/* --- Target Selection Section --- */
.target-select {
    margin-top: 2rem;
    padding: 1.5rem;
    background: var(--bg-subtle);
    border-radius: var(--radius-xl);
    border: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
}

.target-select label {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--text-main);
}

#target-select {
    flex-grow: 1;
    min-width: 240px;
    max-width: 400px;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-main);
    font-size: 0.875rem;
    color: var(--text-main);
    outline: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    appearance: none; /* Custom arrow look can be added here */
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 16px;
}

#target-select:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

/* --- Action Button --- */
#continue-btn {
    align-self: flex-end;
    margin-top: 1.5rem;
    padding: 12px 32px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9375rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
}

#continue-btn:hover {
    background: var(--primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.35);
}

#continue-btn:active {
    transform: translateY(0);
}

/* --- Animations --- */
@keyframes pulse-highlight {
    0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); }
    100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
}

.pulse {
    animation: pulse-highlight 2s infinite;
}
