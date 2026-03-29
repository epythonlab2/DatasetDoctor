import pandas as pd


def auto_clean(df: pd.DataFrame) -> pd.DataFrame:
    """
    Perform basic automatic cleaning:
    - remove duplicates
    - fill missing values
    - normalize column names
    """

    df = df.drop_duplicates()

    for col in df.columns:

        if df[col].dtype == "object":
            df[col] = df[col].fillna("unknown")
        else:
            df[col] = df[col].fillna(df[col].median())

    df.columns = df.columns.str.lower().str.replace(" ", "_")

    return df
