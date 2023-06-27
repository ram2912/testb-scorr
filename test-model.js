const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

async function predictRating() {
  // Load the model
  const modelPath = '/Users/shrirampawar/Documents/SCORR-backend-test/trained_model/model.json';
  const model = await tf.loadLayersModel(`file://${modelPath}`);

  // Define the input data for prediction
  const input = [
    "750-67-8428",   // Invoice ID
    "A",             // Branch
    "Yangon",        // City
    "Member",        // Customer type
    "Female",        // Gender
    "Health and beauty",   // Product line
    74.69,           // Unit price
    7,                // Quantity
    26.1415,          // Tax 5%
    548.9715,         // Total
    new Date('1/5/2019').getTime(),    // Date (converted to timestamp)
    new Date('1/5/2019 13:08').getTime(),    // Time (converted to timestamp)
    "Ewallet",        // Payment
    522.83,          // cogs
    4.761904762,     // gross margin percentage
    26.1415          // gross income
  ];

  // Reshape the input array to have shape [1, 15]
  const inputData = tf.tensor2d(input, [1, 16]);

  // Print the input data for verification
  console.log('Input Data:');
  inputData.print();

  // Perform prediction
  const predictions = model.predict(inputData);

  // Convert the predictions tensor to a regular array
  const predictionsArray = predictions.arraySync();

  // Print the predictions
  console.log('Predictions:');
  console.log(predictionsArray);
}

// Call the predictRating function
predictRating();


