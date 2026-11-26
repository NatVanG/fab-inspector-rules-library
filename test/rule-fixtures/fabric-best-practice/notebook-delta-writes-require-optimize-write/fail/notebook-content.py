# Fabric notebook source

# CELL ********************

df = spark.read.table("LH_Bronze.orders")
df.write.format("delta").mode("overwrite").saveAsTable("LH_Silver.orders")
