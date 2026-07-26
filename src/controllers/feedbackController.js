const prisma =
    require("../config/prisma");


// ==========================================
// CREATE FEEDBACK
// ==========================================

const createFeedback = async (req, res) => {

    try {

        // ==========================================
        // REQUEST DATA
        // ==========================================
    
        const {
            orderId,
            rating,
            comment
        } = req.body;
    
    
        // ==========================================
        // VALIDATE ORDER ID
        // ==========================================
    
        if(
            !orderId ||
            !Number.isInteger(
                Number(orderId)
            )
        ){
    
            return res.status(400).json({
    
                error:
                    "Valid orderId is required"
    
            });
    
        }
    
    
        // ==========================================
        // VALIDATE RATING
        // ==========================================
    
        const numericRating =
            Number(rating);
    
    
        if(
            !Number.isInteger(
                numericRating
            ) ||
            numericRating < 1 ||
            numericRating > 5
        ){
    
            return res.status(400).json({
    
                error:
                    "Rating must be an integer between 1 and 5"
    
            });
    
        }
    
    
        // ==========================================
        // VALIDATE COMMENT
        // ==========================================
    
        if(
            comment !== undefined &&
            comment !== null &&
            typeof comment !== "string"
        ){
    
            return res.status(400).json({
    
                error:
                    "Comment must be text"
    
            });
    
        }
    
    
        const cleanComment =
            typeof comment === "string"
                ? comment.trim()
                : "";
    
    
        if(cleanComment.length > 500){
    
            return res.status(400).json({
    
                error:
                    "Comment cannot exceed 500 characters"
    
            });
    
        }
    
    
        // ==========================================
        // FIND ORDER
        // ==========================================
    
        const order =
            await prisma.order.findUnique({
    
                where: {
    
                    id:
                        Number(orderId)
    
                }
    
            });
    
    
        if(!order){
    
            return res.status(404).json({
    
                error:
                    "Order not found"
    
            });
    
        }
    
    
        // ==========================================
        // CHECK EXISTING FEEDBACK
        // ==========================================
    
        const existingFeedback =
            await prisma.feedback.findUnique({
    
                where: {
    
                    orderId:
                        order.id
    
                }
    
            });
    
    
        if(existingFeedback){
    
            return res.status(409).json({
    
                error:
                    "Feedback already submitted for this order"
    
            });
    
        }
    
    
        // ==========================================
        // CREATE FEEDBACK
        // ==========================================
    
        const feedback =
            await prisma.feedback.create({
    
                data: {
    
                    rating:
                        numericRating,
    
                    comment:
                        cleanComment || null,
    
                    orderId:
                        order.id,
    
                    branchId:
                        order.branchId
    
                }
    
            });
    
    
        // ==========================================
        // RESPONSE
        // ==========================================
    
        res.status(201).json(
            feedback
        );
    
    }

    catch(error){

        console.error(
            "Failed to create feedback:",
            error
        );

        res.status(500).json({

            error:
                "Failed to create feedback"

        });

    }

};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {

    createFeedback

};