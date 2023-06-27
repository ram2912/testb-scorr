import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from keras.layers import Dense


df = pd.read_csv('/Users/shrirampawar/Documents/SCORR-backend-test/AI/Churn.csv')
X = pd.get_dummies(df.drop(['Churn', 'Customer ID'], axis=1))
y = df['Churn'].apply(lambda x: 1 if x == 'Yes' else 0)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=.2)

y_train = y_train.astype(np.float32)

print(X_train.dtypes)


model = RandomForestClassifier(n_estimators=100)

bool_columns = X_train.select_dtypes(include=bool).columns
X_train[bool_columns] = X_train[bool_columns].astype(int)

model.fit(X_train, y_train)


bool_columns = X_test.select_dtypes(include=bool).columns
X_test[bool_columns] = X_test[bool_columns].astype(int)

y_hat = model.predict(X_test)
y_hat = [0 if val < 0.5 else 1 for val in y_hat]

print(y_hat)

accuracy_score(y_test, y_hat)

print('Accuracy: ',accuracy_score(y_test, y_hat))

importances = model.feature_importances_

# Create a DataFrame to hold feature importances
feature_importances = pd.DataFrame({'Feature': X.columns, 'Importance': importances})

# Sort the features by importance in descending order
feature_importances = feature_importances.sort_values('Importance', ascending=False)

top_features = feature_importances['Feature'][:5]

for feature in top_features:
    values = X_train[feature]
    churn_no_values = values[y_train == 0]
    top_value = churn_no_values.value_counts().idxmax()
    print(f"Feature: {feature}")
    print(f"Top Value for Churn = No: {top_value}")
    print()



