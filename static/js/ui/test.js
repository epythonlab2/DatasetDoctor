<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DatasetDoctor - Intelligence at the Source</title>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #2563eb;
            --primary-hover: #1d4ed8;
            --bg-main: #f8fafc;
            --card-bg: #ffffff;
            --border-color: #e2e8f0;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --success: #10b981;
            --danger: #ef4444;
            --purple: #8b5cf6;
            --radius-xl: 24px;
            --radius-lg: 16px;
            --radius-md: 12px;
            --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            --shadow-lg: 0 20px 25px -5px rgb(0 0 0 / 0.1);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-main);
            color: var(--text-main);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }

        .doctor-dialog {
            background: var(--card-bg);
            width: 100%;
            max-width: 850px;
            height: 90vh;
            border-radius: var(--radius-xl);
            box-shadow: var(--shadow-lg);
            border: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
        }

        .header {
            padding: 24px 32px;
            border-bottom: 1px solid var(--border-color);
            background: #ffffff;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .brand-section {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .brand-icon {
            background: var(--primary);
            color: white;
            padding: 10px;
            border-radius: var(--radius-md);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }

        .brand-text h1 {
            font-size: 1.25rem;
            font-weight: 800;
            letter-spacing: -0.025em;
        }

        .brand-text span {
            color: var(--primary);
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 4px;
        }

        .ping-circle {
            width: 8px;
            height: 8px;
            background: var(--success);
            border-radius: 50%;
            position: relative;
        }

        .ping-circle::after {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            background: var(--success);
            border-radius: 50%;
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }

        @keyframes ping {
            75%, 100% { transform: scale(2.5); opacity: 0; }
        }

        .content-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 32px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .card {
            background: #fff;
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            padding: 20px;
            transition: all 0.2s ease;
        }

        .card:hover {
            border-color: #cbd5e1;
            box-shadow: var(--shadow-sm);
        }

        .flex-between {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
        }

        .icon-box {
            width: 48px;
            height: 48px;
            border-radius: var(--radius-md);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .icon-purple { background: #f5f3ff; color: var(--purple); }
        .icon-rose { background: #fff1f2; color: var(--danger); }
        .icon-emerald { background: #ecfdf5; color: var(--success); }
        .icon-blue { background: #eff6ff; color: var(--primary); }

        .btn {
            padding: 10px 24px;
            border-radius: 9999px;
            font-weight: 700;
            font-size: 0.875rem;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.15);
        }

        .btn-primary:hover {
            background: var(--primary-hover);
            transform: translateY(-1px);
        }

        .btn-outline {
            background: transparent;
            border: 2px solid #e2e8f0;
            color: var(--text-main);
        }

        .btn-outline:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
        }

        .tag-container {
            background: #f8fafc;
            border: 1px dashed var(--border-color);
            border-radius: var(--radius-md);
            padding: 12px;
            min-height: 54px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 16px 0;
        }

        .tag {
            background: white;
            border: 1px solid var(--border-color);
            padding: 4px 12px;
            border-radius: 999px;
            font-size: 0.75rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from { transform: translateX(-10px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        select {
            width: 100%;
            padding: 10px 16px;
            border-radius: var(--radius-md);
            border: 1px solid var(--border-color);
            outline: none;
            font-size: 0.875rem;
            appearance: none;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center;
            background-color: white;
        }

        .batch-bar {
            position: absolute;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%) translateY(120px);
            width: 90%;
            max-width: 650px;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.4);
            border-radius: 32px;
            padding: 16px 28px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            z-index: 100;
            transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .batch-bar.active {
            transform: translateX(-50%) translateY(0);
        }

        .batch-info {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .batch-badge {
            background: var(--primary);
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 1rem;
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
        }

        .progress-track {
            flex: 1;
            height: 6px;
            background: #e2e8f0;
            border-radius: 10px;
            margin: 0 24px;
            overflow: hidden;
            display: none;
        }

        .progress-fill {
            width: 0%;
            height: 100%;
            background: var(--primary);
            transition: width 0.3s ease;
        }

        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }

        @media (max-width: 640px) {
            .grid-2 { grid-template-columns: 1fr; }
            .content-scroll { padding: 16px; }
            .doctor-dialog { height: 100vh; border-radius: 0; }
        }

        .footer {
            padding: 16px 32px;
            background: #fcfcfc;
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .text-xs { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 4px; display: block;}
    </style>
</head>
<body>

    <div class="doctor-dialog">
        <header class="header">
            <div class="brand-section">
                <div class="brand-icon">
                    <i data-lucide="sparkles" size="24"></i>
                </div>
                <div class="brand-text">
                    <h1>DatasetDoctor<span>.Cleaning</span></h1>
                    <div class="status-badge">
                        <div class="ping-circle"></div>
                        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Engine V3.0 • Optimized</span>
                    </div>
                </div>
            </div>
            <button class="btn btn-outline" style="padding: 8px;"><i data-lucide="settings" size="18"></i></button>
        </header>

        <main class="content-scroll">
            
            <!-- Deduplication -->
            <section class="card">
                <div class="flex-between">
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <div class="icon-box icon-purple">
                            <i data-lucide="layers-2"></i>
                        </div>
                        <div>
                            <h3 style="font-weight: 700; margin-bottom: 2px;">Remove Duplicates</h3>
                            <p style="font-size: 0.875rem; color: var(--text-muted);">Exact row-level overlap cleansing.</p>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="Pipeline.add('Dedupe', 'All Columns')">Add to Pipeline</button>
                </div>
            </section>

            <!-- Drop Columns -->
            <section class="card">
                <div class="flex-between">
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <div class="icon-box icon-rose">
                            <i data-lucide="trash-2"></i>
                        </div>
                        <div>
                            <h3 style="font-weight: 700; margin-bottom: 2px;">Drop Columns</h3>
                            <p style="font-size: 0.875rem; color: var(--text-muted);">Prune unnecessary dimensions.</p>
                        </div>
                    </div>
                </div>
                
                <div id="drop-tags" class="tag-container">
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">No columns selected...</span>
                </div>

                <div style="display: flex; gap: 12px;">
                    <select id="col-selector" style="flex: 1;">
                        <option value="" disabled selected>Select column to drop...</option>
                        <option value="user_internal_id">user_internal_id</option>
                        <option value="temp_cache_string">temp_cache_string</option>
                        <option value="legacy_flag">legacy_flag</option>
                    </select>
                    <button class="btn btn-outline" onclick="Pipeline.addDrop()">Add</button>
                </div>
            </section>

            <div class="grid-2">
                <!-- Imputation -->
                <section class="card">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 20px;">
                        <div class="icon-box icon-emerald" style="width: 36px; height: 36px;">
                            <i data-lucide="database-zap" size="18"></i>
                        </div>
                        <h3 style="font-weight: 700; font-size: 0.95rem;">Smart Imputation</h3>
                    </div>
                    
                    <span class="text-xs">Target Column</span>
                    <select id="impute-col" style="margin-bottom: 16px;">
                        <option>Age_Records</option>
                        <option>Revenue_USD</option>
                    </select>

                    <span class="text-xs">Strategy</span>
                    <select id="impute-method" style="margin-bottom: 24px;">
                        <option value="mean">Mean (Average)</option>
                        <option value="median">Median (Robust)</option>
                        <option value="mode">Mode (Frequent)</option>
                    </select>

                    <button class="btn btn-outline" style="width: 100%; justify-content: center;" onclick="Pipeline.addImpute()">Queue Action</button>
                </section>

                <!-- Schema Casting -->
                <section class="card">
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 20px;">
                        <div class="icon-box icon-blue" style="width: 36px; height: 36px;">
                            <i data-lucide="binary" size="18"></i>
                        </div>
                        <h3 style="font-weight: 700; font-size: 0.95rem;">Schema Casting</h3>
                    </div>

                    <span class="text-xs">Column</span>
                    <select id="cast-col" style="margin-bottom: 16px;">
                        <option>timestamp_iso</option>
                        <option>is_verified</option>
                    </select>

                    <span class="text-xs">Desired Type</span>
                    <select id="cast-type" style="margin-bottom: 24px;">
                        <option>DateTime</option>
                        <option>Boolean</option>
                        <option>Float64</option>
                    </select>

                    <button class="btn btn-outline" style="width: 100%; justify-content: center;" onclick="Pipeline.addCast()">Queue Action</button>
                </section>
            </div>
        </main>

        <footer class="footer">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">&copy; 2026 DatasetDoctor Intelligence</span>
            <button class="btn btn-outline" style="padding: 6px 16px; font-size: 0.75rem;">Close Suite</button>
        </footer>

        <div id="batch-bar" class="batch-bar">
            <div class="batch-info">
                <div id="batch-badge" class="batch-badge">0</div>
                <div>
                    <p id="pipeline-title" style="font-weight: 800; font-size: 0.875rem; color: #1e293b;">Pipeline Queued</p>
                    <p id="pipeline-subtitle" style="font-size: 0.7rem; color: #64748b; font-weight: 500;">Operations ready for batch engine.</p>
                </div>
            </div>

            <div id="progress-track" class="progress-track">
                <div id="progress-fill" class="progress-fill"></div>
            </div>

            <div id="batch-actions" style="display: flex; gap: 12px; align-items: center;">
                <button onclick="Pipeline.clear()" style="background: none; border: none; font-size: 0.75rem; font-weight: 700; color: #94a3b8; cursor: pointer;">Discard</button>
                <button class="btn btn-primary" onclick="Pipeline.execute()" style="padding: 10px 24px;">Execute Analysis</button>
            </div>
        </div>
    </div>

    <script>
        lucide.createIcons();

        const Pipeline = {
            queue: [],
            dropped: [],

            add(type, label) {
                this.queue.push({ type, label, id: Date.now() });
                this.refreshUI();
            },

            addDrop() {
                const el = document.getElementById('col-selector');
                const val = el.value;
                if(!val || this.dropped.includes(val)) return;
                
                this.dropped.push(val);
                this.add('Drop', val);
                this.renderDropTags();
            },

            removeDrop(val) {
                this.dropped = this.dropped.filter(x => x !== val);
                this.queue = this.queue.filter(q => !(q.type === 'Drop' && q.label === val));
                this.renderDropTags();
                this.refreshUI();
            },

            renderDropTags() {
                const container = document.getElementById('drop-tags');
                if(this.dropped.length === 0) {
                    container.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">No columns selected...</span>`;
                    return;
                }
                container.innerHTML = this.dropped.map(col => `
                    <div class="tag">
                        ${col}
                        <i data-lucide="x" size="12" style="cursor: pointer; color: var(--danger);" onclick="Pipeline.removeDrop('${col}')"></i>
                    </div>
                `).join('');
                lucide.createIcons();
            },

            addImpute() {
                const col = document.getElementById('impute-col').value;
                const method = document.getElementById('impute-method').value;
                this.add('Impute', `${col} via ${method}`);
            },

            addCast() {
                const col = document.getElementById('cast-col').value;
                const type = document.getElementById('cast-type').value;
                this.add('Cast', `${col} to ${type}`);
            },

            refreshUI() {
                const bar = document.getElementById('batch-bar');
                const badge = document.getElementById('batch-badge');
                
                if(this.queue.length > 0) {
                    bar.classList.add('active');
                    badge.innerText = this.queue.length;
                } else {
                    bar.classList.remove('active');
                }
            },

            clear() {
                this.queue = [];
                this.dropped = [];
                this.renderDropTags();
                this.refreshUI();
            },

            async execute() {
                const actions = document.getElementById('batch-actions');
                const progress = document.getElementById('progress-track');
                const fill = document.getElementById('progress-fill');
                const title = document.getElementById('pipeline-title');
                const subtitle = document.getElementById('pipeline-subtitle');

                actions.style.display = 'none';
                progress.style.display = 'block';
                title.innerText = "Processing Data...";

                for(let i = 0; i <= 100; i += 5) {
                    fill.style.width = i + '%';
                    subtitle.innerText = `Synchronizing block ${Math.ceil(i/20)} of 5...`;
                    await new Promise(r => setTimeout(r, 60));
                }

                title.innerHTML = '<span style="color: var(--success)">Analysis Complete</span>';
                subtitle.innerText = "500k rows synchronized successfully.";

                setTimeout(() => {
                    this.clear();
                    actions.style.display = 'flex';
                    progress.style.display = 'none';
                    title.innerText = "Pipeline Queued";
                    subtitle.innerText = "Operations ready for batch engine.";
                }, 2500);
            }
        };
    </script>
</body>
</html>
