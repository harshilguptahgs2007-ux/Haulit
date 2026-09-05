from flask import Flask
from flask_cors import CORS
from extensions import db, jwt
import config


def create_app():
    app = Flask(__name__)
    app.config.from_object(config)

    CORS(app, origins="*", supports_credentials=True)
    db.init_app(app)
    jwt.init_app(app)

    from auth.routes import auth_bp
    from orders.routes import orders_bp
    from vehicles.routes import vehicles_bp

    app.register_blueprint(auth_bp,     url_prefix="/api/auth")
    app.register_blueprint(orders_bp,   url_prefix="/api/orders")
    app.register_blueprint(vehicles_bp, url_prefix="/api/vehicles")

    with app.app_context():
        db.create_all()

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
