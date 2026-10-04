const prisma = require("../config/prisma");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfTomorrow() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function formatDuration(milliseconds) {
  if (!milliseconds || milliseconds <= 0) {
    return "0m 00s";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function average(values) {
  if (!values.length) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/*
|--------------------------------------------------------------------------
| GET /api/owner/overview
|--------------------------------------------------------------------------
|
| Query params:
|
| ?branchId=1
| ?branchId=all
|
| Currently the Overview dashboard works on today's data.
|
|--------------------------------------------------------------------------
*/

const getOverviewData = async (req, res) => {
  try {
    const { branchId } = req.query;

    const todayStart = startOfToday();
    const tomorrowStart = startOfTomorrow();

    /*
    |--------------------------------------------------------------------------
    | Branch filter
    |--------------------------------------------------------------------------
    */

    const branchFilter =
      branchId && branchId !== "all"
        ? {
            branchId: Number(branchId),
          }
        : {};

    /*
    |--------------------------------------------------------------------------
    | Fetch branches
    |--------------------------------------------------------------------------
    */

    const branches = await prisma.branch.findMany({
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        name: true,
        location: true,
      },
    });

    /*
    |--------------------------------------------------------------------------
    | Fetch today's orders
    |--------------------------------------------------------------------------
    */

    const orders = await prisma.order.findMany({
      where: {
        ...branchFilter,
        createdAt: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },

      include: {
        branch: true,

        items: {
          include: {
            menuItem: true,
          },
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

    /*
    |--------------------------------------------------------------------------
    | Basic overview metrics
    |--------------------------------------------------------------------------
    */

    const totalOrders = orders.length;

    const totalRevenue = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0
    );

    const averageOrderValue =
      totalOrders > 0 ? totalRevenue / totalOrders : 0;

    /*
    |--------------------------------------------------------------------------
    | Live operation counts
    |--------------------------------------------------------------------------
    */

    const placedOrders = orders.filter(
      (order) => order.status === "PLACED"
    );

    const preparingOrders = orders.filter(
      (order) => order.status === "PREPARING"
    );

    const readyOrders = orders.filter(
      (order) => order.status === "READY"
    );

    /*
    |--------------------------------------------------------------------------
    | Delayed orders
    |--------------------------------------------------------------------------
    |
    | An order is considered delayed when it has been PREPARING
    | for more than 15 minutes.
    |
    */

    const now = new Date();

    const delayedOrders = preparingOrders.filter((order) => {
      if (!order.startedAt) return false;

      const elapsed =
        now.getTime() - new Date(order.startedAt).getTime();

      return elapsed > 15 * 60 * 1000;
    });

    /*
    |--------------------------------------------------------------------------
    | Preparation time
    |--------------------------------------------------------------------------
    |
    | Preparation time = startedAt -> readyAt
    |
    | We only calculate this for orders where both timestamps exist.
    |
    */

    const preparationTimes = orders
      .filter((order) => order.startedAt && order.readyAt)
      .map((order) => {
        return (
          new Date(order.readyAt).getTime() -
          new Date(order.startedAt).getTime()
        );
      })
      .filter((duration) => duration > 0);

    const averagePreparationTime = average(preparationTimes);

    /*
    |--------------------------------------------------------------------------
    | Collection time
    |--------------------------------------------------------------------------
    |
    | Collection time = readyAt -> collectedAt
    |
    */

    const collectionTimes = orders
      .filter((order) => order.readyAt && order.collectedAt)
      .map((order) => {
        return (
          new Date(order.collectedAt).getTime() -
          new Date(order.readyAt).getTime()
        );
      })
      .filter((duration) => duration > 0);

    const averageCollectionTime = average(collectionTimes);

    /*
    |--------------------------------------------------------------------------
    | Store performance
    |--------------------------------------------------------------------------
    */

    const storePerformance = branches
      .filter((branch) => {
        if (!branchId || branchId === "all") return true;

        return branch.id === Number(branchId);
      })
      .map((branch) => {
        const branchOrders = orders.filter(
          (order) => order.branchId === branch.id
        );

        const branchRevenue = branchOrders.reduce(
          (sum, order) => sum + Number(order.totalAmount || 0),
          0
        );

        const branchPreparationTimes = branchOrders
          .filter((order) => order.startedAt && order.readyAt)
          .map((order) => {
            return (
              new Date(order.readyAt).getTime() -
              new Date(order.startedAt).getTime()
            );
          })
          .filter((duration) => duration > 0);

        const branchAveragePreparation = average(
          branchPreparationTimes
        );

        const branchDelayedOrders = branchOrders.filter((order) => {
          if (
            order.status !== "PREPARING" ||
            !order.startedAt
          ) {
            return false;
          }

          const elapsed =
            now.getTime() -
            new Date(order.startedAt).getTime();

          return elapsed > 15 * 60 * 1000;
        });

        const activeOrders = branchOrders.filter((order) =>
          ["PLACED", "PREPARING", "READY"].includes(order.status)
        );

        return {
          id: branch.id,
          name: branch.name,
          location: branch.location,

          orders: branchOrders.length,

          revenue: branchRevenue,

          averagePreparationTime:
            formatDuration(branchAveragePreparation),

          delayedOrders: branchDelayedOrders.length,

          activeOrders: activeOrders.length,
        };
      });

    /*
    |--------------------------------------------------------------------------
    | Hourly order activity
    |--------------------------------------------------------------------------
    |
    | Creates:
    |
    | [
    |   {
    |     hour: "10 AM",
    |     orders: 12,
    |     revenue: 1440
    |   }
    | ]
    |
    */

    const hourlyActivity = Array.from(
      { length: 24 },
      (_, hour) => ({
        hour,
        orders: 0,
        revenue: 0,
      })
    );

    orders.forEach((order) => {
      const hour = new Date(order.createdAt).getHours();

      hourlyActivity[hour].orders += 1;
      hourlyActivity[hour].revenue += Number(
        order.totalAmount || 0
      );
    });

    /*
    |--------------------------------------------------------------------------
    | Operational signals
    |--------------------------------------------------------------------------
    |
    | These are observations, not recommendations.
    |
    */

    const oneHourAgo = new Date(
      now.getTime() - 60 * 60 * 1000
    );

    const recentOrders = orders.filter(
      (order) =>
        new Date(order.createdAt).getTime() >=
        oneHourAgo.getTime()
    );

    const recentLongPreparationOrders = recentOrders.filter(
      (order) => {
        if (!order.startedAt || !order.readyAt) return false;

        const preparationTime =
          new Date(order.readyAt).getTime() -
          new Date(order.startedAt).getTime();

        return preparationTime > 10 * 60 * 1000;
      }
    );

    const waitingReadyOrders = readyOrders.filter((order) => {
      if (!order.readyAt) return false;

      const waitingTime =
        now.getTime() -
        new Date(order.readyAt).getTime();

      return waitingTime > 5 * 60 * 1000;
    });

    const signals = [];

    if (recentLongPreparationOrders.length > 0) {
      signals.push({
        type: "preparation",
        count: recentLongPreparationOrders.length,
        message: `${recentLongPreparationOrders.length} orders exceeded 10 minutes in the last hour`,
      });
    }

    if (waitingReadyOrders.length > 0) {
      signals.push({
        type: "collection",
        count: waitingReadyOrders.length,
        message: `${waitingReadyOrders.length} ready orders have been waiting for more than 5 minutes`,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.json({
      success: true,

      period: {
        name: "Today",
        start: todayStart,
        end: tomorrowStart,
      },

      filters: {
        branchId:
          branchId && branchId !== "all"
            ? Number(branchId)
            : "all",
      },

      summary: {
        totalOrders,
        totalRevenue,
        averageOrderValue,

        averagePreparationTime:
          formatDuration(averagePreparationTime),

        averageCollectionTime:
          formatDuration(averageCollectionTime),

        storesCount:
          branchId && branchId !== "all"
            ? 1
            : branches.length,
      },

      liveOperations: {
        placed: placedOrders.length,
        preparing: preparingOrders.length,
        ready: readyOrders.length,
        delayed: delayedOrders.length,
      },

      hourlyActivity,

      stores: storePerformance,

      signals,
    });
  } catch (error) {
    console.error(
      "Error fetching owner overview:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load overview data",
    });
  }
};

module.exports = {
  getOverviewData,
};