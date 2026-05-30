const prisma = require("../lib/prisma");

const createCategory = async (req, res) => {
  try {
    const { name, branchId } = req.body;

    const category = await prisma.menuCategory.create({
      data: {
        name,
        branchId,
      },
    });

    res.json(category);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Failed to create category",
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await prisma.menuCategory.findMany({
      include: {
        branch: true,
      },
    });

    res.json(categories);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Failed to fetch categories",
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
};