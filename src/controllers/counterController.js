const prisma = require("../config/prisma");


// =====================
// GET READY ORDERS
// =====================

const getCounterOrders = async (req, res) => {

    try {

        const orders =
            await prisma.order.findMany({

                where: {
                    status: "READY"
                },

                select: {
                    id: true,
                    tokenNumber: true,
                    readyAt: true,

                    items: {
                        select: {

                            quantity: true,

                            menuItem: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    }
                },

                orderBy: {
                    readyAt: "asc"
                }
            });

        res.json(orders);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
};


// =====================
// COLLECT ORDER
// =====================

const collectOrder = async (req, res) => {

    try {

        const order =
            await prisma.order.update({

                where: {
                    id: Number(req.params.id)
                },

                data: {
                    status: "COLLECTED",
                    collectedAt: new Date()
                },

                select: {
                    id: true,
                    tokenNumber: true,
                    status: true
                }
            });

        const io =
            req.app.get("io");

        io.emit(
            "ORDER_COLLECTED",
            order
        );

        res.json(order);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
};

module.exports = {
    getCounterOrders,
    collectOrder
};