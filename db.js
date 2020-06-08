const mongodb = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

mongodb.connect(
  process.env.CONNECTIONSTRING,
  { useNewUrlParser: true, useUnifiedTopology: true },
  (err, client) => {
    if (err) {
      console.log(err);
    }
    module.exports = client;
    const app = require('./app');
    app.listen(process.env.PORT, () => console.log(`App started on port ${process.env.PORT}`));
    console.log('DB successfully connected.');
  },
);
