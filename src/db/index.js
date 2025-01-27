import mongoose from "mongoose";

import {DB_NAME} from "../constants.js";

const dataBaseConnetion = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.DATABASE_URI}/${DB_NAME}`
    );
    console.log(
      `MongoDB Connected! DB_Host: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("\n MongoDb Connection Faild!", error);
    process.exit(1);
  }
};

export default dataBaseConnetion;

