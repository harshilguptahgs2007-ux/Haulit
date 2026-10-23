from flask import Flask, jsonify
from flask_cors import CORS
from extensions import db, jwt
import config


def create_app():
    app = Flask(__name__)
    app.config.from_object(config)

    CORS(app,origins="*", supports_credentials=True,allow_headers="*",methods="*")
    db.init_app(app)
    jwt.init_app(app)

    @jwt.unauthorized_loader
    def unauthorized_callback(reason):
        return jsonify({"error": "Missing authorization token. Please log in.", "msg": str(reason)}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(reason):
        return jsonify({"error": "Invalid authorization token. Please log in again.", "msg": str(reason)}), 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"error": "Session token has expired. Please log in again.", "msg": "Token expired"}), 401

    from auth.routes import auth_bp
    from orders.routes import orders_bp
    from vehicles.routes import vehicles_bp

    app.register_blueprint(auth_bp,     url_prefix="/api/auth")
    app.register_blueprint(orders_bp,   url_prefix="/api/orders")
    app.register_blueprint(vehicles_bp, url_prefix="/api/vehicles")

    with app.app_context():
        db.create_all()
        try:
            from migrate import run_migration
            run_migration()
        except Exception as e:
            app.logger.warning(f"Migration error: {e}")

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000,host="0.0.0.0")
