// Cypress Test Data Strings
// This file contains string constants extracted from the seed data for use in Cypress tests
// Based on the structure of ../server/testData/post_strings.ts but using actual seed data

// Question Descriptions (Titles) from seed data
const Q1_DESC = 'How to properly handle async data fetching in React?';
const Q2_DESC = 'Node.js memory issues when handling large file uploads';
const Q3_DESC = 'Webpack configuration issues with latest JavaScript features';
const Q4_DESC = 'Optimizing a slow PostgreSQL query with JOINs';
const Q5_DESC = 'How to handle edge cases in JavaScript array processing';
const Q6_DESC = 'Fixing CORS issues with fetch API in React frontend';
const Q7_DESC = 'Improving performance of Python data processing script';
const Q8_DESC = 'Docker container environment variable configuration';
const Q9_DESC = 'Proper way to handle async/await in JavaScript';
const Q10_DESC = 'Preventing memory leaks in React applications';

// Question Text Content from seed data
const Q1_TXT =
  "I'm building a React application that fetches data from an API, but I'm running into issues with state management. Sometimes I get errors about updating state on unmounted components, and other times the data doesn't load properly. Here's my current component code:\n\n```javascript\nfunction DataComponent() {\n  const [data, setData] = useState(null);\n  \n  useEffect(() => {\n    api.getData().then(response => {\n      setData(response);\n    }).catch(err => {\n      console.error(err);\n    });\n  }, []);\n  \n  return (\n    <div>\n      {data ? renderData(data) : <Loading />}\n    </div>\n  );\n}\n```\n\nWhat am I doing wrong and how can I fix this pattern?";

const Q2_TXT =
  "I have a Node.js application that allows users to upload files. When dealing with large files (>100MB), the server sometimes crashes with an 'out of memory' error. Here's my current upload handling code:\n\n```javascript\napp.post('/upload', (req, res) => {\n  const form = new formidable.IncomingForm();\n  \n  form.parse(req, (err, fields, files) => {\n    if (err) {\n      return res.status(500).json({ error: err.message });\n    }\n    \n    const fileData = fs.readFileSync(files.uploadFile.path);\n    // Process file data\n    // Save to database or disk\n    \n    res.status(200).json({ message: 'Upload successful' });\n  });\n});\n```\n\nHow can I optimize this to handle large files without running out of memory?";

const Q3_TXT =
  "I'm trying to use the latest JavaScript features (like optional chaining and nullish coalescing) in my React project, but I keep getting syntax errors when webpack tries to build the application. I've updated my babel configuration but it's still not working.\n\nHere's my current webpack.config.js:\n\n```javascript\nmodule.exports = {\n  entry: './src/index.js',\n  output: {\n    path: path.resolve(__dirname, 'dist'),\n    filename: 'bundle.js'\n  },\n  module: {\n    rules: [\n      {\n        test: /\\.js$/,\n        exclude: /node_modules/,\n        use: 'babel-loader'\n      }\n    ]\n  }\n};\n```\n\nAnd my .babelrc:\n\n```json\n{\n  \"presets\": [\"@babel/preset-env\", \"@babel/preset-react\"]\n}\n```\n\nWhat am I missing in my configuration?";

const Q4_TXT =
  "I have a PostgreSQL query that's running very slowly in production. It's a relatively simple query with a JOIN, but it takes over 10 seconds to execute even though the tables aren't that large (around 100k rows each).\n\n```sql\nSELECT u.id, u.email, u.full_name, p.bio\nFROM users u\nLEFT JOIN profiles p ON u.id = p.user_id\nWHERE u.status = 'active'\n  AND u.created_at > '2025-01-01'\nORDER BY u.created_at DESC\nLIMIT 100;\n```\n\nI've run EXPLAIN ANALYZE and it shows a sequential scan is being used. How can I optimize this query for better performance?";

// Answer Text Content from seed data
const A1_TXT =
  "The issue with your React component is that you're not handling the state correctly. When working with asynchronous data fetching in React, you should use the useEffect hook with proper dependency array and cleanup function. Here's how you can fix it:\n\n```javascript\nconst [data, setData] = useState(null);\nconst [loading, setLoading] = useState(true);\nconst [error, setError] = useState(null);\n\nuseEffect(() => {\n  let isMounted = true;\n  \n  const fetchData = async () => {\n    try {\n      const response = await api.getData();\n      if (isMounted) {\n        setData(response);\n        setLoading(false);\n      }\n    } catch (err) {\n      if (isMounted) {\n        setError(err);\n        setLoading(false);\n      }\n    }\n  };\n  \n  fetchData();\n  \n  return () => {\n    isMounted = false;\n  };\n}, []);\n```\n\nThis pattern ensures you won't have memory leaks or state updates on unmounted components.";

const A2_TXT =
  "Your Node.js memory issue is likely caused by not properly managing large file uploads. When handling file uploads in Node.js, you should use streams instead of loading the entire file into memory. Here's an example using `multer` and streams:\n\n```javascript\nconst multer = require('multer');\nconst fs = require('fs');\nconst storage = multer.diskStorage({\n  destination: function (req, file, cb) {\n    cb(null, './uploads/')\n  },\n  filename: function (req, file, cb) {\n    cb(null, Date.now() + '-' + file.originalname)\n  }\n});\n\nconst upload = multer({ storage: storage });\n\napp.post('/upload', upload.single('file'), (req, res) => {\n  const readStream = fs.createReadStream(req.file.path);\n  const writeStream = fs.createWriteStream('./processed/' + req.file.filename);\n  \n  readStream.pipe(writeStream);\n  \n  writeStream.on('finish', () => {\n    res.status(200).send('File processed successfully');\n  });\n});\n```\n\nThis approach is much more memory-efficient for large files.";

const A3_TXT =
  "The error you're seeing with webpack is because you need to configure babel-loader properly to handle the latest JavaScript features. Update your webpack.config.js file like this:\n\n```javascript\nmodule.exports = {\n  // ...\n  module: {\n    rules: [\n      {\n        test: /\\.jsx?$/,\n        exclude: /node_modules/,\n        use: {\n          loader: 'babel-loader',\n          options: {\n            presets: [\n              ['@babel/preset-env', { targets: { browsers: ['last 2 versions'] } }],\n              '@babel/preset-react'\n            ],\n            plugins: [\n              '@babel/plugin-proposal-class-properties',\n              '@babel/plugin-transform-runtime'\n            ]\n          }\n        }\n      }\n    ]\n  }\n};\n```\n\nThis configuration will properly transpile modern JavaScript syntax.";

const A4_TXT =
  "Your PostgreSQL query is performing poorly because it's missing proper indexing. For this specific query pattern, you should add an index on the columns you're frequently filtering by. Connect to your database and run:\n\n```sql\nCREATE INDEX idx_users_email ON users(email);\nCREATE INDEX idx_users_status_created_at ON users(status, created_at);\n```\n\nThen optimize your query:\n\n```sql\nSELECT u.id, u.email, u.full_name, p.bio\nFROM users u\nLEFT JOIN profiles p ON u.id = p.user_id\nWHERE u.status = 'active'\n  AND u.created_at > '2025-01-01'\nORDER BY u.created_at DESC\nLIMIT 100;\n```\n\nThis should dramatically improve your query performance.";

// Additional test data for various Cypress test scenarios
const TEST_USERNAME = 'testuser';
const TEST_QUESTION_TITLE = 'Test Question for Cypress';
const TEST_QUESTION_TEXT = 'This is a test question created during Cypress testing.';
const TEST_ANSWER_TEXT = 'This is a test answer created during Cypress testing.';
const TEST_TAG = 'javascript';

// Error messages that might appear in the application
const ERROR_EMPTY_TITLE = 'Title cannot be empty';
const ERROR_EMPTY_ANSWER = 'Answer text cannot be empty';
const ERROR_EMPTY_TEXT = 'Question text cannot be empty';

// User interface text
const WELCOME_MESSAGE = 'Welcome to CodeStack!';
const ASK_QUESTION_BUTTON = 'Ask a Question';
const POST_QUESTION_BUTTON = 'Post Question';
const ANSWER_QUESTION_BUTTON = 'Answer Question';
const POST_ANSWER_BUTTON = 'Post Answer';
const QUESTIONS_LINK = 'Questions';
const UNANSWERED_FILTER = 'Unanswered';
const ACTIVE_FILTER = 'Active';

export {
  // Question descriptions
  Q1_DESC,
  Q2_DESC,
  Q3_DESC,
  Q4_DESC,
  Q5_DESC,
  Q6_DESC,
  Q7_DESC,
  Q8_DESC,
  Q9_DESC,
  Q10_DESC,

  // Question texts
  Q1_TXT,
  Q2_TXT,
  Q3_TXT,
  Q4_TXT,

  // Answer texts
  A1_TXT,
  A2_TXT,
  A3_TXT,
  A4_TXT,

  // Test data
  TEST_USERNAME,
  TEST_QUESTION_TITLE,
  TEST_QUESTION_TEXT,
  TEST_ANSWER_TEXT,
  TEST_TAG,

  // Error messages
  ERROR_EMPTY_TITLE,
  ERROR_EMPTY_ANSWER,
  ERROR_EMPTY_TEXT,

  // UI text
  WELCOME_MESSAGE,
  ASK_QUESTION_BUTTON,
  POST_QUESTION_BUTTON,
  ANSWER_QUESTION_BUTTON,
  POST_ANSWER_BUTTON,
  QUESTIONS_LINK,
  UNANSWERED_FILTER,
  ACTIVE_FILTER,
};
