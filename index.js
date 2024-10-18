const express = require('express');
const mysql = require('mysql');
const port = process.env.PORT || 5000
const cors = require('cors');


const app = express();

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173', 
    methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 
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

    if (!name || !email || !photoURL || !role) {
        return res.status(400).send("All fields are required.");
    }

    const checkEmailSql = "SELECT * FROM users WHERE email = ?";
    db.query(checkEmailSql, [email], (err, results) => {
        if (err) {
            console.error("Error checking email:", err);
            return res.status(500).send("Error checking email");
        }

        if (results.length > 0) {
            return res.status(400).send("Email already exists. Please use a different email.");
        } else {
            const insertUserSql = "INSERT INTO users (name, email, photoURL, role) VALUES (?, ?, ?, ?)";
            db.query(insertUserSql, [name, email, photoURL, role], (err, result) => {
                if (err) {
                    console.error("Error inserting data:", err); 
                    return res.status(500).send({error: "Error inserting data"});
                }
                res.status(200).send("User added successfully");
            });
        }
    });
});

app.post("/buy", (req, res) => {
    const { product_id, buyer_email, seller_email ,quantity } = req.body;
    
    const quantityQuery = `SELECT quantity, price FROM products WHERE id = ?`;
    
    db.query(quantityQuery, [product_id], (err, results) => {
        if (err) {
            return res.status(400).send({ error: "Failed to fetch product quantity" });
        }
    
        const availableQuantity = results[0].quantity;
        if (availableQuantity < quantity) {
            return res.status(400).send({ error: "Insufficient product quantity" });
        }
        const price = results[0].price;
    
        const query = `INSERT INTO buy_sell (product_id, quantity, buyer_email, seller_email,price, date) VALUES (?, ?, ?, ?, ?, NOW())`;
    
        db.query(query, [product_id, quantity, buyer_email, seller_email, price], (err, result) => {
            if (err) {
                return res.status(400).send({ error: "Failed to buy product" });
            }
            const queryDelete = `DELETE FROM cart WHERE product_id = ? AND user_email = ?`;
            db.query(queryDelete, [product_id, buyer_email], (err) => {
                if (err) {
                    return res.status(400).send({ error: "Failed to remove item from cart" });
                }
                const updateQuantity = availableQuantity - quantity;
                const updateQuantityQuery = `UPDATE products SET quantity = ? WHERE id = ?`;
                db.query(updateQuantityQuery, [updateQuantity, product_id], (err) => {
                    if (err) {
                        return res.status(400).send({ error: "Failed to update product quantity" });
                    }
                    
                    res.status(200).send({message: "Product bought successfully"});
                });
            });
        });
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

app.get("/products/:email", (req, res)=>{
    const email = req.params.email;

    const query = 'SELECT * FROM products WHERE email= ?';
    db.query(query, [email], (err, result)=>{
        if(err){
            return res.status(400).send("Something went wrong.");
        }
        console.log(result);
        
        res.send(result)
    })
})

app.post("/add-cart", (req,res)=>{
    const { product_id, user_email, seller_email } = req.body;
    
    if(seller_email === user_email){
        return res.status(400).send({message: "Cannot cart own product."})
    }

    const checkQuery = `
    SELECT * FROM cart WHERE product_id = ? AND user_email = ?
    `
    db.query(checkQuery, [product_id, user_email], (err, results)=>{
        if(err){
            return res.status(400).send({error: "Something went wrong. "});
        }
        if(results.length >0){
            const existingQuantity = results[0].quantity;
            const newQuantity = existingQuantity+1;
            
            const updateQuantity = `
            UPDATE cart SET quantity = ?, added_at = NOW() WHERE product_id = ? AND user_email = ? 
            `

            db.query(updateQuantity, [newQuantity, product_id, user_email], (err, result)=>{
                if (err) {
                    return res.status(500).json({ error: 'Database error while updating' });
                }
                return res.json({ message: 'Cart updated successfully' });
            })
        }
        else{
            const insertQuery = `
            INSERT INTO cart (product_id, user_email, quantity, added_at) 
                VALUES (?, ?, ?, NOW())
            `

            db.query(insertQuery, [product_id, user_email, 1], (err, result)=>{
                if (err) {
                    return res.status(500).json({ error: 'Database error while inserting' });
                }
                return res.json({ message: 'Item added to cart successfully' });
            })
        }
    })
    
})

app.get("/cart/:email", (req, res) => {
    const email = req.params.email;

    const query = `
    SELECT 
    cart.id,
    cart.product_id,
    cart.user_email,
    cart.quantity,
    cart.added_at,
    products.name as product_name,
    products.category as product_category,
    products.price as product_price,
    products.image as product_image,
    products.email as seller_email
    FROM cart 
    JOIN products
    ON cart.product_id = products.id
    WHERE user_email = ?
    `;

    db.query(query, [email], (err, result) => {
        if (err) {
            return res.status(400).send({ error: "Failed to fetch cart from DB" });
        }

        return res.send(result);
    });
});

app.patch("/cart/:id", (req,res)=>{
    const id = req.params.id;
    const {quantity} = req.body;

    const productQuantity = `SELECT products.quantity FROM products JOIN cart ON products.id = cart.product_id WHERE cart.id = ?`;
    
    

    db.query(productQuantity, [id], (err, result)=>{
        
        if (result[0].quantity < quantity){
            return res.status(200).send({message: "Quantity not available"});
        }
        else{
            const query = `
    UPDATE cart SET quantity = ? WHERE id = ?
    `;
    db.query(query, [quantity, id], (err, result)=>{
        if(err){
            return res.status(400).send({error: "Failed to update cart"});
        }
        return res.status(200).send({message: "Updated"});
    })
        }
    })
    
})

app.delete("/product/:id", (req, res)=>{
    const id = req.params.id;

    const query = `
    DELETE FROM products WHERE id = ?
    `;
    db.query(query, [id], (err, result)=>{
        if(err){
            return res.status(400).send({error: "Failed to delete from DB"})
        }
        return res.status(200).send({message: "Deleted"})
    })
})

app.delete("/cart/:id", (req, res)=>{
    const id = req.params.id;

    const query = `
    DELETE FROM cart WHERE id = ?
    `;
    db.query(query, [id], (err, result)=>{
        if(err){
            return res.status(400).send({error: "Failed to delete from DB"})
        }
        return res.status(200).send({message: "Deleted"})
    })
})

app.get("/", (req, res) => {
    res.send("Craft Fusion Server Running ");
  });


app.listen(port, () => {
    console.log("Server is listening on port: ",port);
});
