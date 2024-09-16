const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData)

const mg = mailgun.client({
    username: 'api',
    key: '74a9e7edcd79ac79bda8f3cbad87bae7-51356527-8e1eb9bd'
})
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
//  middleware
app.use(cors({
    origin: 'https://bistro-restaurant-f5ef2.web.app', // Replace with your client's origin
    origin: 'http://localhost:5173', // Replace with your client's origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@application.i3zwrks.mongodb.net/?retryWrites=true&w=majority&appName=application`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});




async function run() {
    try {


        await client.connect();
        console.log('runign database')
        const userCollection = client.db("bistro-restaurant").collection("user")
        const menuCollection = client.db("bistro-restaurant").collection("menu")
        const projectCollection = client.db("bistro-restaurant").collection("project")
        const reviewCollection = client.db("bistro-restaurant").collection("review")
        const cartCollection = client.db("bistro-restaurant").collection("cart")
        const paymentCollection = client.db("bistro-restaurant").collection("payments")


        // jwt releted api

        app.post('/jwt', async (req, res) => {

            const user = req.body;
            console.log(process.env.ACCESS_TOKEN)
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });

            res.send({ token });
        })

        // middlerWares
        const verifyToken = (req, res, next) => {


            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];

            jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {

                if (err) {
                    console.log(err)
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })

        }



        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }



        // user


        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

            const result = await userCollection.find().toArray();
            res.send(result);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            console.log(req.decoded.email)

            if (email !== req.decoded.email) {

                return res.status(403).send({ message: 'forbidden access' })

            }
            const query = { email: email };
            const user = await userCollection.findOne(query);

            let admin = false;
            if (user) {
                admin =
                    user?.role === 'admin';
            }
            res.send({ admin });
        })




        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnt exists: 
            // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const reslut = await userCollection.deleteOne(query)
            res.send(reslut)
        })


        app.get('/project', async (req, res) => {

            const result = await projectCollection.find().toArray();
            res.send(result)
        })

        app.get('/project/:id', async (req, res) => {
            const id = req.params._id;
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await projectCollection.findOne(id);
            console.log(result)

            res.send(result);
        })

        app.post('/project', verifyToken, verifyAdmin, async (req, res) => {

            const item = req.body;
            const result = await projectCollection.insertOne(item)
            res.send(result)
        })

        app.patch('/menu/:id', async (req, res) => {
            const item = req.body;
            const id = req.params._id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    recipe: item.recipe,
                    image: item.image
                }
            }

            const result = await menuCollection.updateOne({ id }, updatedDoc)
            res.send(result);
        })

        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            // 642c155b2c4774f05c36eeaa
            // 642c155b2c4774f05c36eeaa
            const id = req.params._id;
            const result = await menuCollection.deleteOne(id)

            res.send(result)

        })
        app.get('/reviews', async (req, res) => {

            const result = await reviewCollection.find().toArray();
            res.send(result)
        })


        //carts 

        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result);
        });

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })



        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });
        app.get('/payments/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            if (req.params.email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })



        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);

            //  carefully delete each item from the cart
            console.log('payment info', payment);
            const query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            };

            const deleteResult = await cartCollection.deleteMany(query);

            mg.messages.create('sandbox7b499d06bc1e49f69c2b1d17b872db79.mailgun.org', {
                from: "Excited User <postmaster@sandbox7b499d06bc1e49f69c2b1d17b872db79.mailgun.org>",
                to: ["test@example.com"],
                subject: "Hello",
                text: "Testing some Mailgun awesomeness!",
                html: "<h1>Testing some Mailgun awesomeness!</h1>"
            })
                .then(msg => console.log(msg)) // logs response data
                .catch(err => console.log(err));
            res.send({ paymentResult, deleteResult });
        })





        // using aggregate pipeline

        app.get('/order-stats', async (req, res) => {
            const result = await paymentCollection.aggregate([
                {
                    $unwind: '$menuItemIds'
                },
                {
                    $lookup: {
                        from: 'menu',
                        localField: 'menuItemIds',
                        foreignField: '_id',
                        as: 'menuItems'
                    }
                },
                {
                    $unwind: '$menuItems'
                },
                {
                    $group: {
                        _id: '$menuItems.category',
                        quantity: { $sum: 1 },
                        revenue: { $sum: '$menuItems.price' }

                    }

                },
                {
                    $project: {
                        _id: 0,
                        category: "$_id",
                        quantity: '$quantity'
                    }
                }

            ]).toArray()

            res.send(result)
        })


        // stats or analytics


        app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const menuItems = await menuCollection.estimatedDocumentCount();
            const orders = await paymentCollection.estimatedDocumentCount();

            // this is not the best way
            // const payments = await paymentCollection.find().toArray();
            // const revenue = payments.reduce((total, payment) => total + payment.price, 0);

            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray();

            const revenue = result.length > 0 ? result[0].totalRevenue : 0;

            res.send({
                users,
                menuItems,
                orders,
                revenue
            })
        })


    } finally {


    }
}
run().catch(console.dir);








app.get('/', (req, res) => {
    res.send('hello');
});

app.listen(port, () => {
    console.log(`server ringing on port ${port}`); // Corrected the console log message
});





// Create a MongoClient with a MongoClientOptions object to set the Stable API version







