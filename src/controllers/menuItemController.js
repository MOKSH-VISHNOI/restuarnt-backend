const prisma = require("../lib/prisma");

const createMenuItem = async (req, res) => {
  try {
    console.log("BODY:",req.body);
    const { name, price, categoryId } = req.body;

    const menuItem = await prisma.menuItem.create({
      data: {
        name,
        price,
        categoryId,
      },
    });

    res.status(201).json(menuItem);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create menu item" });
  }
};

const getMenuItems = async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany();

    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const {
      name,
      price,
      available,
      preparationTime
    } = req.body;

    const menuItem = await prisma.menuItem.update({
      where: { id },
      data: {
        name,
        price,
        available,
        preparationTime
      }
    });

    res.json(menuItem);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to update menu item"
    });
  }
};

const deleteMenuItem = async (req, res) => {
  try {

    const id = parseInt(req.params.id);

    await prisma.menuItem.delete({
      where: { id }
    });

    res.json({
      message: "Menu item deleted"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Failed to delete menu item"
    });

  }
};

module.exports = {
  createMenuItem,
  getMenuItems,
  updateMenuItem,
  deleteMenuItem,
};