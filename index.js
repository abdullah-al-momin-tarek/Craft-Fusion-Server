const express = require('express');
const mysql = require('mysql');
const port = process.env.PORT || 5000
const cors = require('cors');


const app = express();

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173', 
    methods: 'GET, POST, PUT, DELETE, OPTIONS', 
  }));


const db = mysql.createConnection({
    host: "localhost",
    user: 'root',
    password: '',
    database: 'craftfusion'
});


db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});


app.post("/add-user", (req, res) => {
    const data = req.body;
    console.log("Received data:", data);

    const { name, email, photoURL, role } = data;

    // Check if required fields are present
    if (!name || !email || !photoURL || !role) {
        return res.status(400).send("All fields are required.");
    }

    // Query to check if the email already exists
    const checkEmailSql = "SELECT * FROM users WHERE email = ?";
    db.query(checkEmailSql, [email], (err, results) => {
        if (err) {
            console.error("Error checking email:", err);
            return res.status(500).send("Error checking email");
        }

        if (results.length > 0) {
            // Email already exists in the database
            return res.status(400).send("Email already exists. Please use a different email.");
        } else {
            // Proceed to insert the user into the database
            const insertUserSql = "INSERT INTO users (name, email, photoURL, role) VALUES (?, ?, ?, ?)";
            db.query(insertUserSql, [name, email, photoURL, role], (err, result) => {
                if (err) {
                    console.error("Error inserting data:", err); 
                    return res.status(500).send("Error inserting data");
                }
                res.status(200).send("User added successfully");
            });
        }
    });
});

app.get("/products", (req,res)=>{
    const query = 'SELECT * FROM products'
    db.query(query, (err, result)=>{
        if(err){
            return res.status(400).send("Something went wrong.");
        }
        res.send(result)
    })
})

app.post("/add-cart", (req,res)=>{
    const data = req.body;
    console.log(data);
    
})



app.get("/", (req, res) => {
    res.send("Craft Fusion Server Running ");
  });


app.listen(port, () => {
    console.log("Server is listening on port: ",port);
});
