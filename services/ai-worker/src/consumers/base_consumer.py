"""Base RabbitMQ consumer with retry logic."""

import json
import logging
import signal
import time
from abc import ABC, abstractmethod
from typing import Any, Optional

import pika
from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import Basic, BasicProperties

from src.config import get_settings

logger = logging.getLogger(__name__)


class BaseConsumer(ABC):
    """Base class for RabbitMQ consumers with retry logic."""

    def __init__(
        self,
        queue_name: str,
        dlq_name: Optional[str] = None,
        max_retries: int = 3,
        retry_delay_base: int = 5,
    ):
        """
        Initialize consumer.

        Args:
            queue_name: Name of the queue to consume from
            dlq_name: Dead letter queue name (optional)
            max_retries: Maximum retry attempts before DLQ
            retry_delay_base: Base delay in seconds (exponential backoff)
        """
        settings = get_settings()
        self.rabbitmq_url = settings.rabbitmq_url
        self.queue_name = queue_name
        self.dlq_name = dlq_name or f"{queue_name}_dlq"
        self.max_retries = max_retries
        self.retry_delay_base = retry_delay_base

        self.connection: Optional[pika.BlockingConnection] = None
        self.channel: Optional[BlockingChannel] = None
        self._shutdown = False

    def connect(self) -> None:
        """Establish connection to RabbitMQ."""
        logger.info(f"Connecting to RabbitMQ: {self.rabbitmq_url}")

        parameters = pika.URLParameters(self.rabbitmq_url)
        parameters.heartbeat = 1800  # 30 minutes - allows for long TTS generation
        parameters.blocked_connection_timeout = 1800

        self.connection = pika.BlockingConnection(parameters)
        self.channel = self.connection.channel()

        # Declare main queue
        self.channel.queue_declare(queue=self.queue_name, durable=True)

        # Declare DLQ
        self.channel.queue_declare(queue=self.dlq_name, durable=True)

        # Set prefetch count to 1 (process one message at a time)
        self.channel.basic_qos(prefetch_count=1)

        logger.info(f"Connected to RabbitMQ, consuming from: {self.queue_name}")

    def disconnect(self) -> None:
        """Close RabbitMQ connection."""
        if self.channel:
            try:
                self.channel.close()
            except Exception as e:
                logger.warning(f"Error closing channel: {e}")

        if self.connection:
            try:
                self.connection.close()
            except Exception as e:
                logger.warning(f"Error closing connection: {e}")

        logger.info("Disconnected from RabbitMQ")

    def _setup_signal_handlers(self) -> None:
        """Setup graceful shutdown signal handlers."""
        def shutdown_handler(signum, frame):
            logger.info(f"Received signal {signum}, shutting down...")
            self._shutdown = True
            if self.channel:
                self.channel.stop_consuming()

        signal.signal(signal.SIGTERM, shutdown_handler)
        signal.signal(signal.SIGINT, shutdown_handler)

    def start(self) -> None:
        """Start consuming messages."""
        self._setup_signal_handlers()
        self.connect()

        try:
            self.channel.basic_consume(
                queue=self.queue_name,
                on_message_callback=self._handle_message,
                auto_ack=False,  # Manual acknowledgment
            )

            logger.info(f"Started consuming from {self.queue_name}")
            self.channel.start_consuming()

        except Exception as e:
            logger.error(f"Consumer error: {e}")
            raise
        finally:
            self.disconnect()

    def _handle_message(
        self,
        channel: BlockingChannel,
        method: Basic.Deliver,
        properties: BasicProperties,
        body: bytes,
    ) -> None:
        """Handle incoming message with retry logic."""
        delivery_tag = method.delivery_tag
        retry_count = self._get_retry_count(properties)

        try:
            # Parse message
            message = json.loads(body.decode("utf-8"))
            logger.info(f"Processing message (attempt {retry_count + 1}/{self.max_retries + 1})")

            # Process message
            self.process_message(message)

            # Acknowledge success
            channel.basic_ack(delivery_tag=delivery_tag)
            logger.info("Message processed successfully")

        except Exception as e:
            logger.error(f"Error processing message: {e}")

            if retry_count >= self.max_retries:
                # Max retries reached, send to DLQ
                logger.warning(f"Max retries reached, sending to DLQ: {self.dlq_name}")
                self._send_to_dlq(body, e)
                channel.basic_ack(delivery_tag=delivery_tag)
            else:
                # Retry with delay
                delay = self.retry_delay_base * (2 ** retry_count)  # Exponential backoff
                logger.info(f"Retrying in {delay} seconds...")
                time.sleep(delay)

                # Republish with incremented retry count
                self._republish_with_retry(body, retry_count + 1)
                channel.basic_ack(delivery_tag=delivery_tag)

    def _get_retry_count(self, properties: BasicProperties) -> int:
        """Get retry count from message headers."""
        if properties.headers and "x-retry-count" in properties.headers:
            return int(properties.headers["x-retry-count"])
        return 0

    def _republish_with_retry(self, body: bytes, retry_count: int) -> None:
        """Republish message with updated retry count."""
        properties = pika.BasicProperties(
            delivery_mode=2,  # Persistent
            headers={"x-retry-count": retry_count},
        )

        self.channel.basic_publish(
            exchange="",
            routing_key=self.queue_name,
            body=body,
            properties=properties,
        )
        logger.info(f"Message republished with retry count: {retry_count}")

    def _send_to_dlq(self, body: bytes, error: Exception) -> None:
        """Send failed message to dead letter queue."""
        # Add error information to message
        try:
            message = json.loads(body.decode("utf-8"))
            message["_dlq_error"] = str(error)
            message["_dlq_timestamp"] = time.time()
            body = json.dumps(message).encode("utf-8")
        except Exception:
            pass

        properties = pika.BasicProperties(
            delivery_mode=2,  # Persistent
        )

        self.channel.basic_publish(
            exchange="",
            routing_key=self.dlq_name,
            body=body,
            properties=properties,
        )
        logger.info(f"Message sent to DLQ: {self.dlq_name}")

    @abstractmethod
    def process_message(self, message: dict[str, Any]) -> None:
        """
        Process a message. Must be implemented by subclasses.

        Args:
            message: Parsed message data

        Raises:
            Exception: If processing fails (will trigger retry)
        """
        pass
