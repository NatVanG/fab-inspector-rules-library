# Fabric notebook source

# METADATA ********************

# META {
# META   "kernel_info": {
# META     "name": "synapse_pyspark"
# META   },
# META   "dependencies": {
# META     "lakehouse": {
# META       "default_lakehouse": "11111111-1111-1111-1111-111111111111",
# META       "default_lakehouse_name": "LH_Bronze",
# META       "default_lakehouse_workspace_id": "22222222-2222-2222-2222-222222222222"
# META     }
# META   }
# META }

# CELL ********************

df = spark.read.table("LH_Bronze.orders")
display(df)
