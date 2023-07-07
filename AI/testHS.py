import requests
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# Make a GET request to the endpoint to retrieve the deals data
response = requests.get("https://testback.scorr-app.eu/extract/all-deals")
deals_data = response.json()

# Split the deals data into smaller batches
batch_size = 400
batches = [deals_data[i:i+batch_size] for i in range(0, len(deals_data), batch_size)]

for batch in batches:
    # Convert the deals data batch to a Pandas DataFrame
    df = pd.DataFrame(batch)

    # Rest of the data processing steps (Steps 3 to 11) go here
    missing_cols = df.columns[df.isnull().any()].tolist()

    # Remove columns with high missing values (e.g., more than 70%)
    threshold = 0.7
    df = df.dropna(thresh=len(df) * threshold, axis=1)

    # Impute missing values for numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())

    # Impute missing values for categorical columns
    categorical_cols = df.select_dtypes(include=["object"]).columns
    df[categorical_cols] = df[categorical_cols].fillna("Unknown")

    # Step 4: Feature Engineering
    # Extract useful information from date columns
    df['createdAt'] = pd.to_datetime(df['createdAt'])
    df['Year'] = df['createdAt'].dt.year
    df['Month'] = df['createdAt'].dt.month

    # Calculate derived features, e.g., duration between important dates

    # Step 5: Data Transformation
    # Exclude columns with dictionary values from one-hot encoding
    exclude_cols = df.select_dtypes(include=[object]).columns
    df_encoded = pd.get_dummies(df.drop(exclude_cols, axis=1))

    # Join back the excluded columns to the encoded DataFrame
    df_encoded = pd.concat([df_encoded, df[exclude_cols]], axis=1)

    # Normalize or scale numeric features
    numeric_cols = df_encoded.select_dtypes(include=[np.number]).columns
    scaler = StandardScaler()
    df_encoded[numeric_cols] = scaler.fit_transform(df_encoded[numeric_cols])

# Step 6: Handling Outliers
# Handle outliers in numeric columns, e.g., cap/extreme values or transformation

# Step 7: Feature Selection
# Perform feature selection using techniques like correlation analysis or feature importance

# Step 8: Data Splitting
# Split the pre-processed dataset into train, validation, and test sets

# Step 9: Model Training

# Step 10: Model Evaluation

# Step 11: Iterate and Improve
    # Print the cleaned data for each batch
    cleaned_data = df_encoded.to_json(orient="records")
    print(cleaned_data)
