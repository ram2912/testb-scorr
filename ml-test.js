const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

// Specify the path to the CSV file
const csvFilePath = path.join(__dirname, 'supermarket_sales - Sheet1.csv');

// Read the CSV file
fs.readFile(csvFilePath, 'utf8', (err, csvData) => {
  if (err) {
    console.error('Error reading CSV file:', err);
    return;
  }

  // Parse the CSV data using tf.data.csv()
  const data = tf.data.csv(`file://${csvFilePath}`, {
    columnConfigs: {
      'Rating': { isLabel: true } // Update the columnConfigs based on your CSV column names
    }
  });

  // Convert features dataset to array
  const featuresArray = [];
  const labelsArray = [];
  data.forEachAsync(({ xs, ys }) => {
    featuresArray.push(Object.values(xs).map(Number));
    labelsArray.push(Number(Object.values(ys)[0]));
  }).then(() => {
    // Split the data into features and labels
    const features = tf.tensor2d(featuresArray);
    const labels = tf.tensor1d(labelsArray);

    // Define and train the model
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 10, inputShape: [16], activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    model.fit(features, labels, { epochs: 10 })
      .then(() => {
        // Save the trained model
        model.save('file:///Users/shrirampawar/Documents/SCORR-backend-test')
          .then(() => console.log('Model saved successfully'))
          .catch((error) => console.error('Error saving the model:', error));

        // Deploy the prediction model
        // ... Set up a Node.js backend API endpoint to handle predictions
      })
      .catch((error) => console.error('Error training the model:', error));
  })
  .catch((error) => console.error('Error converting dataset to array:', error));
});



