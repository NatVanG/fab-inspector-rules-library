# Fabric notebook source

# CELL ********************

spark.conf.set("spark.sql.parquet.vorder.default", "false")
df = spark.read.table("LH_Silver.sales")
df.write.format("delta").mode("overwrite").saveAsTable("LH_Gold.sales")
