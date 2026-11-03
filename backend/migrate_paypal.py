from sqlalchemy import inspect, text

from database import engine


def migrate():
    inspector = inspect(engine)

    if "invoices" not in inspector.get_table_names():
        raise RuntimeError(
            "The invoices table does not exist. Start the API once first."
        )

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("invoices")
    }

    with engine.begin() as connection:
        if "paypal_order_id" not in existing_columns:
            connection.execute(
                text(
                    "ALTER TABLE invoices "
                    "ADD COLUMN paypal_order_id VARCHAR(100)"
                )
            )
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX "
                    "uq_invoices_paypal_order_id "
                    "ON invoices (paypal_order_id)"
                )
            )
            print("Added paypal_order_id.")

        if "paypal_capture_id" not in existing_columns:
            connection.execute(
                text(
                    "ALTER TABLE invoices "
                    "ADD COLUMN paypal_capture_id VARCHAR(100)"
                )
            )
            print("Added paypal_capture_id.")

    print("Migration completed successfully.")


if __name__ == "__main__":
    migrate()
