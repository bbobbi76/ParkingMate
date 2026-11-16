#include "stm32f4xx_hal.h"
#include <stdio.h>
#include "../gate_detector.h"
#include "../reliable_uart.h"
#ifndef BLOCKED_LEVEL
#define BLOCKED_LEVEL 0
#endif
static UART_HandleTypeDef console_uart;
static ReliableUART transport;
static volatile unsigned rx_head = 0, rx_tail = 0;
static volatile uint32_t rx_faults = 0;
static volatile uint8_t rx_ring[128];
static uint8_t rx_byte;

void USART2_IRQHandler(void) { HAL_UART_IRQHandler(&console_uart); }
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *uart) {
    if (uart->Instance != USART2) return;
    unsigned next = (rx_head + 1U) % sizeof(rx_ring);
    if (next != rx_tail) { rx_ring[rx_head] = rx_byte; rx_head = next; }
    else ++rx_faults;
    if (HAL_UART_Receive_IT(&console_uart, &rx_byte, 1) != HAL_OK) ++rx_faults;
}
void HAL_UART_ErrorCallback(UART_HandleTypeDef *uart) {
    if (uart->Instance != USART2) return;
    ++rx_faults;
    __HAL_UART_CLEAR_OREFLAG(uart);
    (void)HAL_UART_Receive_IT(&console_uart, &rx_byte, 1);
}
static void receive_commands(void) {
    unsigned budget = 96;
    while (rx_tail != rx_head && budget--) {
        uint8_t c = rx_ring[rx_tail];
        rx_tail = (rx_tail + 1U) % sizeof(rx_ring);
        pm_receive_byte(&transport, c);
    }
}
static unsigned read_pair(void) {
    return ((int)HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_10) == BLOCKED_LEVEL ? 2U : 0U)
         | ((int)HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_3) == BLOCKED_LEVEL ? 1U : 0U);
}
static void sensor_init(void) {
    GPIO_InitTypeDef pins = {0};
    __HAL_RCC_GPIOA_CLK_ENABLE(); __HAL_RCC_GPIOB_CLK_ENABLE();
    pins.Mode = GPIO_MODE_INPUT; pins.Pull = GPIO_PULLUP;
    pins.Pin = GPIO_PIN_10; HAL_GPIO_Init(GPIOA, &pins); /* Arduino D2 */
    pins.Pin = GPIO_PIN_3; HAL_GPIO_Init(GPIOB, &pins);  /* Arduino D3 */
}
static void fail(void)
{
    __disable_irq();
    while (1) {
    }
}

static void clock_init(void)
{
    RCC_OscInitTypeDef oscillator = {0};
    RCC_ClkInitTypeDef clocks = {0};

    /* Use the internal 16 MHz oscillator; no external clock is required. */
    oscillator.OscillatorType = RCC_OSCILLATORTYPE_HSI;
    oscillator.HSIState = RCC_HSI_ON;
    oscillator.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
    oscillator.PLL.PLLState = RCC_PLL_NONE;
    if (HAL_RCC_OscConfig(&oscillator) != HAL_OK) {
        fail();
    }

    clocks.ClockType = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK |
                       RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    clocks.SYSCLKSource = RCC_SYSCLKSOURCE_HSI;
    clocks.AHBCLKDivider = RCC_SYSCLK_DIV1;
    clocks.APB1CLKDivider = RCC_HCLK_DIV1;
    clocks.APB2CLKDivider = RCC_HCLK_DIV1;
    if (HAL_RCC_ClockConfig(&clocks, FLASH_LATENCY_0) != HAL_OK) {
        fail();
    }
}

static void led_init(void)
{
    GPIO_InitTypeDef pin = {0};
    __HAL_RCC_GPIOA_CLK_ENABLE();
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
    pin.Pin = GPIO_PIN_5;
    pin.Mode = GPIO_MODE_OUTPUT_PP;
    pin.Pull = GPIO_NOPULL;
    pin.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOA, &pin);
}

static void console_init(void)
{
    GPIO_InitTypeDef pins = {0};
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_USART2_CLK_ENABLE();

    /* The onboard ST-LINK virtual COM port is wired to USART2 PA2/PA3. */
    pins.Pin = GPIO_PIN_2 | GPIO_PIN_3;
    pins.Mode = GPIO_MODE_AF_PP;
    pins.Pull = GPIO_NOPULL;
    pins.Speed = GPIO_SPEED_FREQ_LOW;
    pins.Alternate = GPIO_AF7_USART2;
    HAL_GPIO_Init(GPIOA, &pins);

    console_uart.Instance = USART2;
    console_uart.Init.BaudRate = 115200;
    console_uart.Init.WordLength = UART_WORDLENGTH_8B;
    console_uart.Init.StopBits = UART_STOPBITS_1;
    console_uart.Init.Parity = UART_PARITY_NONE;
    console_uart.Init.Mode = UART_MODE_TX_RX;
    console_uart.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    console_uart.Init.OverSampling = UART_OVERSAMPLING_16;
    if (HAL_UART_Init(&console_uart) != HAL_OK) {
        fail();
    }
}

static void send_text(const char *text, uint16_t length)
{
    if (HAL_UART_Transmit(&console_uart, (uint8_t *)text, length, 100) != HAL_OK) {
        fail();
    }
}


static void send_status(const GateDetector *gate) {
    char line[320];
    int n = snprintf(line, sizeof(line),
        "{\"kind\":\"status\",\"device\":\"entry-stm32\",\"protocol\":3,\"session\":\"%s\","
        "\"a\":%u,\"b\":%u,\"queue\":%u,\"dropped\":%lu,\"faults\":%lu}\n",
        transport.session, gate->state / 2, gate->state % 2, transport.used,
        (unsigned long)transport.dropped,
        (unsigned long)(gate->faults + transport.protocol_faults + rx_faults));
    if (n > 0 && (unsigned)n < sizeof(line)) send_text(line, (uint16_t)n);
}
static void send_pending(void) {
    if (!transport.used || !transport.session[0]) return;
    char line[256];
    int n = snprintf(line, sizeof(line),
        "{\"kind\":\"passage\",\"device\":\"entry-stm32\",\"protocol\":3,"
        "\"session\":\"%s\",\"seq\":%lu,\"direction\":\"forward\"}\n",
        transport.session, (unsigned long)transport.queue[transport.head]);
    if (n > 0 && (unsigned)n < sizeof(line)) send_text(line, (uint16_t)n);
}
void SysTick_Handler(void) { HAL_IncTick(); }
int main(void) {
    HAL_Init(); clock_init(); led_init(); console_init(); sensor_init();
    pm_init(&transport);
    HAL_NVIC_SetPriority(USART2_IRQn, 1, 0);
    HAL_NVIC_EnableIRQ(USART2_IRQn);
    if (HAL_UART_Receive_IT(&console_uart, &rx_byte, 1) != HAL_OK) fail();
    GateDetector gate;
    gate_init(&gate, read_pair(), HAL_GetTick(), 80, PM_PASSAGE_TIMEOUT_MS);
    uint32_t status_at = 0, pending_at = 0, led_at = 0;
    int led_active = 0;
    send_status(&gate);
    while (1) {
        uint32_t now = HAL_GetTick();
        receive_commands();
        if (gate_update(&gate, read_pair(), now)) {
            (void)pm_enqueue(&transport);
            HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);
            led_at = now; led_active = 1;
        }
        if (led_active && (uint32_t)(now - led_at) >= 150) {
            HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET); led_active = 0;
        }
        if ((uint32_t)(now - status_at) >= 2000) {
            status_at = now; send_status(&gate);
        }
        if ((uint32_t)(now - pending_at) >= 500) {
            pending_at = now; send_pending();
        }
        HAL_Delay(1);
    }
}
