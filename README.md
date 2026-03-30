# DatasetDoctor:- Dataset Health Check Tool

## Overview

DatasetDoctor is a Dataset Health Check Tool which is a Python-based utility designed to analyze,
validate, and improve dataset quality before it is used in machine
learning workflows.

It focuses on detecting hidden data issues that often degrade model
performance, such as inconsistencies, outliers, and data leakage.

------------------------------------------------------------------------

## Features

### 1. Structural Analysis

-   Dataset shape and schema validation
-   Data type consistency checks
-   Duplicate detection
-   Missing value analysis (including patterns)

### 2. Statistical Analysis

-   Simple Statistical analysis ✅
-   Outlier detection (IQR, Z-score) ✅
-   Cardinality checks ✅
-   Range validation(future plan)

### 3. Semantic Checks

-   Category normalization (case inconsistencies)
-   Unit inconsistencies detection 
-   Text cleaning and encoding fixes
-   Date and format validation 

### 4. Relationship Analysis

-   Correlation matrix
-   Multicollinearity detection
-   Feature redundancy checks
-   Data leakage detection

### 5. Label Quality (for supervised learning)

-   Class imbalance detection ✅
-   Rare class identification
-   Suspicious label patterns

------------------------------------------------------------------------

## Data Quality Scoring

The tool provides an interpretable quality score:

``` json
{
  "overall_score": 0.78,
  "breakdown": {
    "completeness": 0.82,
    "uniqueness": 0.91,
    "consistency": 0.63
  }
}
```

------------------------------------------------------------------------

## Project Structure

------------------------------------------------------------------------
## Create Virtual Environment
On Linux / macOS
```bash
python3 -m venv venv
source venv/bin/activate
```
On Windows
```bash
python -m venv venv
venv\\Scripts\\activate
```

## Installation

``` bash
git clone https://github.com/epythonlab2/DatasetDoctor.git
cd DatasetDoctor
pip install -r requirements.txt
```

------------------------------------------------------------------------

## Usage
Run on Terminal
``` python
uvicorn app:app --reload
```

------------------------------------------------------------------------

## Example Output

-   Missing value report
-   Correlation heatmap
-   Outlier summary
-   Data quality score

------------------------------------------------------------------------

## Roadmap

-   Auto-fix data issues
-   Dataset version comparison
-   Data drift detection
-   Web dashboard (FastAPI + Chart.js)

------------------------------------------------------------------------

## Why This Tool?

Most machine learning failures are caused by poor data quality, not poor
models.

This tool helps: - Detect problems early - Improve dataset reliability -
Build better models faster

------------------------------------------------------------------------

## Contributing

Contributions are welcome. Feel free to open issues or submit pull
requests.

------------------------------------------------------------------------

## License

MIT License

------------------------------------------------------------------------

## Author

Developed by Asibeh Tenager(asibeh.tenaager@gmail.com)
