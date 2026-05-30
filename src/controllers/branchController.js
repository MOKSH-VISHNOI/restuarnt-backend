const prisma = require("../lib/prisma");

const getBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany();

    res.json(branches);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Failed to fetch branches",
    });
  }
};

const createBranch = async (req, res) => {
  try {
    const { name, location } = req.body;

    const branch = await prisma.branch.create({
      data: {
        name,
        location,
      },
    });

    res.status(201).json(branch);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Failed to create branch",
    });
  }
};

const updateBranch = async (req, res) => {
  try {

    const { id } = req.params;

    const { name, location } = req.body;

    const updatedBranch = await prisma.branch.update({
      where: {
        id: Number(id),
      },

      data: {
        name,
        location,
      },
    });

    res.json(updatedBranch);

  } catch (error) {

    console.log(error);

    res.status(500).json({
      error: "Failed to update branch",
    });

  }
};

const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.branch.delete({
      where: {
        id: Number(id),
      },
    });

    res.json({
      message: "Branch deleted successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "Failed to delete branch",
    });
  }
};

module.exports = {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
};