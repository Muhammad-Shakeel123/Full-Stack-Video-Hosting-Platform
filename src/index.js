import dotenv from "dotenv";
import dataBaseConnetion from "./db/index.js";
import {app} from "./app.js";
dotenv.config({
  path: "./env",
});

dataBaseConnetion()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is listning on port: ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB Connection Faild!!", error);
  });
