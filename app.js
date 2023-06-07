const express = require("express");
const { open } = require("sqlite");
const sqlite = require("sqlite3");
const path = require("path");
const format = require("date-fns/format");
const isMatch = require("date-fns/isMatch");
const isValid = require("date-fns/isValid");
const toDate = require("date-fns/toDate");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "./todoApplication.db");
let db = null;

const convertCase = (obj) => {
  return {
    id: obj.id,
    todo: obj.todo,
    priority: obj.priority,
    category: obj.category,
    status: obj.status,
    dueDate: obj.due_date,
  };
};

const checkRequestQueries = (request, response, next) => {
  let {
    id,
    todo,
    status,
    priority,
    search_q,
    category,
    dueDate,
  } = request.body;

  if (Object.keys(request.query).length !== 0) {
    const { status, priority, category, date } = request.query;
    dueDate = date;
  }

  let e = false;
  if (status !== undefined) {
    let a = ["TO DO", "IN PROGRESS", "DONE"];

    if (a.includes(status)) {
      request.status = status;
    } else {
      e = true;
      response.status(400);
      response.send("Invalid Todo Status");
      return;
    }
  }
  if (priority !== undefined) {
    let a = ["HIGH", "MEDIUM", "LOW"];

    if (a.includes(priority)) {
      request.priority = priority;
    } else {
      e = true;
      response.status(400);
      response.send("Invalid Todo Priority");
      return;
    }
  }
  if (category !== undefined) {
    let a = ["WORK", "HOME", "LEARNING"];

    if (a.includes(category)) {
      request.category = category;
    } else {
      e = true;
      response.status(400);
      response.send("Invalid Todo Category");
      return;
    }
  }
  if (dueDate !== undefined) {
    try {
      const myDate = new Date(dueDate);
      const formattedDate = format(new Date(dueDate), "yyyy-MM-dd");

      const result = toDate(new Date(formattedDate));

      const isValidDate = isValid(result);

      console.log(isValidDate);
      if (isValidDate) {
        request.dueDate = formattedDate;
      } else {
        e = true;
        response.status(400);
        response.send("Invalid Due Date");
        return;
      }
    } catch (error) {
      response.status(400);
      response.send("Invalid Due Date");
      return;
    }
  }

  request.id = id;
  request.todo = todo;
  if (!e) {
    next();
  }
};

const queryBuild = (request, response, next) => {
  const { status, priority, search_q, category } = request.query;
  let search = search_q;
  let query;
  let e = false;
  let qw = 0;
  if (status !== undefined) {
    let a = ["TO DO", "IN PROGRESS", "DONE"];

    if (a.includes(status)) {
      query = `SELECT * FROM todo WHERE status = '${status}'`;
      qw = 1;
    } else {
      e = true;
      response.status(400);
      response.send("Invalid Todo Status");
      return;
    }
  }

  if (priority !== undefined) {
    let b = ["HIGH", "MEDIUM", "LOW"];
    if (b.includes(priority)) {
      if (qw === 1) {
        query = query.concat(" AND ", `priority = '${priority}'`);
      } else {
        qw = 1;
        query = `SELECT * FROM todo WHERE priority ='${priority}'`;
      }
    } else {
      e = true;
      response.status(400);
      response.send("Invalid Todo Priority");
      return;
    }
  }

  if (search !== undefined) {
    if (qw === 1) {
      query = query.concat(" AND ", `todo LIKE '%${search}%'`);
    } else {
      qw = 1;
      query = `SELECT * FROM todo WHERE todo LIKE '%${search}%'`;
    }
  }

  if (category !== undefined) {
    let c = ["WORK", "HOME", "LEARNING"];
    if (c.includes(category)) {
      if (qw === 1) {
        query = query.concat(" AND ", `category = '${category}'`);
      } else {
        qw = 1;
        query = `SELECT * FROM todo WHERE category = '${category}'`;
      }
    } else {
      e = true;
      response.status(400);
      response.send("Invalid Todo Category");
      return;
    }
  }
  if (!e) {
    request.q = query;
    next();
  }
};

const initializeServerAndDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite.Database,
    });
    app.listen(3000, () => {
      console.log("SERVER IS RUNNING AT 3000");
    });
  } catch (e) {
    console.log(`DB GOT AN ${e.message}`);
    process.exit(1);
  }
};

initializeServerAndDB();

app.get("/todos/", queryBuild, async (request, response) => {
  const result = await db.all(request.q);
  response.send(result.map((item) => convertCase(item)));
});

app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const query = `SELECT * FROM todo WHERE id = ${todoId}`;
  const result = await db.get(query);
  response.send(convertCase(result));
});

app.get("/agenda/", checkRequestQueries, async (request, response) => {
  const { date } = request.query;
  const dateFormat = format(new Date(date), "yyyy-MM-dd");
  const query = ` SELECT * FROM todo WHERE due_date = '${dateFormat}';`;

  const result = await db.all(query);

  if (result === undefined) {
    response.status(400);
    response.send("Invalid Due Date");
    return;
  } else {
    response.send(result.map((item) => convertCase(item)));
  }
});

app.post("/todos/", checkRequestQueries, async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;
  const query = `INSERT INTO todo(id, todo, priority, status, category, due_date)
                                VALUES (${id},'${todo}','${priority}','${status}','${category}','${dueDate}')`;
  const result = await db.run(query);
  response.send("Todo Successfully Added");
});

app.get("/todos/:todoId", checkRequestQueries, async (request, response) => {
  const { todoId } = request.params;
  const { status, priority, todo, category, dueDate } = request.body;

  let query = null;
  let responseText = null;

  switch (true) {
    case status !== undefined:
      query = `UPDATE todo SET status = '${status}'`;
      responseText = "Status Updated";
      break;

    case priority !== undefined:
      query = `UPDATE todo SET priority = '${priority}'`;
      responseText = "Priority Updated";
      break;

    case todo !== undefined:
      query = `UPDATE todo SET todo = '${todo}'`;
      responseText = "Todo Updated";
      break;

    case category !== undefined:
      query = `UPDATE todo SET category = '${category}'`;
      responseText = "Category Updated";
      break;

    case dueDate !== undefined:
      query = `UPDATE todo SET due_date = '${dueDate}'`;
      responseText = "Due Date Updated";
      break;

    default:
      break;
  }

  const result = await db.run(query);
  response.send(responseText);
});

app.delete("/todos/:todoId", async (request, response) => {
  const { todoId } = request.params;
  const query = `DELETE FROM todo WHERE id = ${todoId}`;
  const result = await db.run(query);
  response.send("Todo Deleted");
});

module.exports = app;
