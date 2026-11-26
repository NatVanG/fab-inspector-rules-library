# Fabric notebook source

# CELL ********************

spark.conf.set("spark.microsoft.delta.optimizeWrite.enabled", "true")
df = spark.read.table("LH_Bronze.orders")
df.write.format("delta").mode("overwrite").saveAsTable("LH_Silver.orders")
