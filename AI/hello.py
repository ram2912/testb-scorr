import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import requests
import json

import numpy as np
from sklearn.ensemble import RandomForestClassifier

response = requests.get('https://testback.scorr-app.eu/extract/clean-data')
data = response.json()

cleaned_deals = data['cleanedDeals']

df = pd.DataFrame(cleaned_deals)

target = 'Is Closed Won'

selected_columns = ['Latest Source', 'Latest Source Company', 'Latest Source Contact',
                    'Original Source Type',
                    'Number of Associated Contacts', 'Number of Sales Activities',
                    'Opportunity Cluster', target]

df = df['properties'].apply(pd.Series)
df = df[selected_columns]

df = df.fillna(0)

X = pd.get_dummies(df.drop(target, axis=1))
y = df[target].apply(lambda x: 1 if x == 'true' else 0)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=.2)

model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)

y_hat = model.predict(X_test)
y_hat = [0 if val < 0.5 else 1 for val in y_hat]

accuracy = accuracy_score(y_test, y_hat)
print('Accuracy:', accuracy)

importances = model.feature_importances_

# Create a DataFrame to hold feature importances
feature_importances = pd.DataFrame({'Feature': X.columns, 'Importance': importances})

# Sort the features by importance in descending order
feature_importances = feature_importances.sort_values('Importance', ascending=False)

top_features = feature_importances['Feature'][:5]

top_features_json = []
for feature in top_features:
    feature_weight = feature_importances.loc[feature_importances['Feature'] == feature, 'Importance'].values[0]
    top_features_json.append({'Feature': feature, 'Importance': feature_weight})

# Create a factor importance table
factor_importance = feature_importances.groupby(feature_importances['Feature'].str.split('_', expand=True)[0])['Importance'].mean()
factor_importance = factor_importance.sort_values(ascending=False)

factor_importance_json = []
for factor, importance in factor_importance.items():
    factor_importance_json.append({'Factor': factor, 'Importance': importance})

result = {
    'Top Features without Values': top_features_json,
    'Factor Importance (Percentage)': factor_importance_json[:5]
}

result_json = json.dumps(result)

print(result_json)

result = {
    'Top Features without Values': top_features_json,
    'Factor Importance (Percentage)': factor_importance_json[:5]
}

result_json = json.dumps(result)

# Define the URL of your Node.js endpoint
url = 'https://testback.scorr-app.eu/extract/model'

# Set the headers for the POST request
headers = {'Content-Type': 'application/json'}

# Make the POST request to your Node.js endpoint with the JSON data
response = requests.post(url, data=result_json, headers=headers)

# Check the response status code
if response.status_code == 200:
    print('JSON result successfully sent to the Node.js backend.')
else:
    print('Failed to send JSON result to the Node.js backend.')









