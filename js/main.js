function onLoad() {
    //Добавление функции подстановки в шаблон значений наподобии String.format в Java
    if (!String.prototype.format) {
        String.prototype.format = function () {
            var args = arguments;
            return this.replace(/{(\d+)}/g, function (match, number) {
                return typeof args[number] != 'undefined' ? args[number] : match;
            });
        };
    }
    //При загрузке начинаем новую игру
    SeaBattle.showUserNameDialog();
}

var Utils = (function() {
    function shuffle(o) {
        for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
        return o;
    }

    function getRandomNumber(min, max) {
        return Math.floor(Math.random() * (max - min) + min);
    }

    return {
        shuffle: shuffle,
        getRandomNumber: getRandomNumber
    };
})();

var SeaBattle = (function () {
    var firstStart = true; //флаг означает что игра только запущена либо окончилась победой
    var clearSea = 0; // море
    var breakShip = 1; // попадание по кораблю
    var bombCrash = 2; // холостой удар
    var ship = 3; // судно
    var userMap = []; //карта игрока
    var compMap = []; //карта компьютера
    var userShips; //корабли игрока
    var compShips; //корабли компа
    var isUserShoot = true; //флаг хода игрока
    var compHits = []; // успешные удары компьютера
    var userClearField = []; //возможные клетки игрока по которым не было произведено ударов
    var name = ""; //имя пользователя

    /**
     * Начальное заполнение поля "морем"
     * @param map
     */
    function fillSea(map) {
        for (var i = 0; i < 10; i++) {
            map[i] = [];
            for (var j = 0; j < 10; j++) {
                map[i][j] = clearSea;
            }
        }
    }

    /**
     * Начальное заполнение списка "чистыми" клетками
     */
    function fillUsrClearField() {
        for (var m = 0; m < 10; m++) {
            for (var n = 0; n < 10; n++) {
                userClearField.push({i: m, j: n});
            }
        }
        // перемешивание для случайности ударов
        userClearField = Utils.shuffle(userClearField);
    }


    /**
     * Перерисовка игрового поля
     * @param map карта
     * @param divId id контейнера
     * @param isUserMap заполняется карта игрока?
     */
    function redrawField(map, divId, isUserMap) {
        var trs = "";
        for (var i = 0; i < 10; i++) {
            var tds = "";
            for (var j = 0; j < 10; j++) {
                var state = map[i][j];
                if (state == clearSea) {
                    tds += getFormattedTD("clearSea", isUserMap ? "" : "SeaBattle.shoot({0},{1})".format(i, j));
                } else if (state == breakShip) {
                    tds += getFormattedTD("breakShip", "");
                } else if (state == bombCrash) {
                    tds += getFormattedTD("bombCrash", "");
                } else if (state == ship) {
                    tds += getFormattedTD(!isUserMap ? "clearSea" : "ship", isUserMap ? "" : "SeaBattle.shoot({0},{1})".format(i, j));
                } else {
                    throw new Error("Unknown state");
                }
            }
            trs += ("<tr>{0}</tr>".format(tds));
        }
        var tableStr = "<table class='tableField'>{0}</table>".format(trs);
        $("#" + divId).empty().append(tableStr);
    }

    /**
     * Формирование клетки игрового поля
     * @param className класс CSS
     * @param onclick событие при нажатии
     * @returns {*}
     */
    function getFormattedTD(className, onclick) {
        return "<td  onclick='{1}'><div class='{0} tableFieldDiv'></div></td>".format(className, onclick);
    }

    /**
     * Генереция кораблей на карте
     * @param map карта
     * @returns {Array} список кораблей
     */
    function generateShips(map) {
        var ships = [];
        ships.push({countDeck: 4, coords: generateShipCoords(map, 4), crashed: false});
        ships.push({countDeck: 3, coords: generateShipCoords(map, 3), crashed: false});
        ships.push({countDeck: 3, coords: generateShipCoords(map, 3), crashed: false});
        ships.push({countDeck: 2, coords: generateShipCoords(map, 2), crashed: false});
        ships.push({countDeck: 2, coords: generateShipCoords(map, 2), crashed: false});
        ships.push({countDeck: 2, coords: generateShipCoords(map, 2), crashed: false});
        ships.push({countDeck: 1, coords: generateShipCoords(map, 1), crashed: false});
        ships.push({countDeck: 1, coords: generateShipCoords(map, 1), crashed: false});
        ships.push({countDeck: 1, coords: generateShipCoords(map, 1), crashed: false});
        ships.push({countDeck: 1, coords: generateShipCoords(map, 1), crashed: false});
        return ships;
    }

    /**
     * Генерация корабля
     * @param map
     * @param countDeck количество палуб
     * @returns {*} координаты корабля
     */
    function generateShipCoords(map, countDeck) {
        //случайные координаты
        var randI = Utils.getRandomNumber(0, 10);
        var randJ = Utils.getRandomNumber(0, 10);
        //положение корабля
        var pos = Utils.getRandomNumber(0, 2); // 1 - горизонтально, 0 - вертикально
        var coords = [];
        if (map[randI][randJ] != clearSea) { //проверка на имеющийся корабль в начальных координатах
            return generateShipCoords(map, countDeck);
        } else if ((pos == 0 && randI + (countDeck - 1) > 9) || (pos == 1 && randJ + (countDeck - 1) > 9)) { // проверка на выход за границы карты
            return generateShipCoords(map, countDeck);
        } else { //проверка на присутствие других кораблей на пути корабля и в радиусе 1 клетки вокруг корабля
            if (pos == 0) {// если вертикально - идем вниз по одной клетке
                for (var h = randI; h < randI + countDeck; h++) {
                    //проверки если начало корабля
                    if (h == randI) {
                        if (h - 1 >= 0 && map[h - 1][randJ] != clearSea) { //проверяем клетку вверх
                            return generateShipCoords(map, countDeck);
                        }
                        if (h - 1 >= 0 && randJ - 1 >= 0 && map[h - 1][randJ - 1] != clearSea) { //проверяем клетку вверх и влево
                            return generateShipCoords(map, countDeck);
                        }
                        if (h - 1 >= 0 && randJ + 1 <= 9 && map[h - 1][randJ + 1] != clearSea) { //проверяем клетку вверх и вправо
                            return generateShipCoords(map, countDeck);
                        }
                    }
                    if (randJ - 1 >= 0 && map[h][randJ - 1] != clearSea) { //проверяем клетку вправо
                        return generateShipCoords(map, countDeck);
                    }
                    if (randJ + 1 <= 9 && map[h][randJ + 1] != clearSea) { //проверяем клетку влево
                        return generateShipCoords(map, countDeck);
                    }
                    //проверки если конец корабля
                    if (h == randI + (countDeck - 1)) {
                        if (h + 1 <= 9 && randJ - 1 >= 0 && map[h + 1][randJ - 1] != clearSea) { //проверяем клетку вниз и влево
                            return generateShipCoords(map, countDeck);
                        }
                        if (h + 1 <= 9 && map[h + 1][randJ] != clearSea) { //проверяем клетку вниз
                            return generateShipCoords(map, countDeck);
                        }
                        if (h + 1 <= 9 && randJ + 1 <= 9 && map[h + 1][randJ + 1] != clearSea) { //проверяем клетку вниз и вправо
                            return generateShipCoords(map, countDeck);
                        }
                    }
                    var coord = {};
                    coord.i = h;
                    coord.j = randJ;
                    coord.crashed = false;
                    coords.push(coord);
                }
            } else {//если горизонтально - идем вправо
                for (var h = randJ; h < randJ + countDeck; h++) {
                    //проверки если начало корабля
                    if (h == randJ) {
                        if (h - 1 >= 0 && map[randI][h - 1] != clearSea) { //проверяем клетку влево
                            return generateShipCoords(map, countDeck);
                        }
                        if (h - 1 >= 0 && randI - 1 >= 0 && map[randI - 1][h - 1] != clearSea) { //проверяем клетку влево и вверх
                            return generateShipCoords(map, countDeck);
                        }
                        if (h - 1 >= 0 && randI + 1 <= 9 && map[randI + 1][h - 1] != clearSea) { //проверяем клетку влево и вниз
                            return generateShipCoords(map, countDeck);
                        }
                    }
                    if (randI - 1 >= 0 && map[randI - 1][h] != clearSea) { //проверяем клетку вверх
                        return generateShipCoords(map, countDeck);
                    }
                    if (randI + 1 <= 9 && map[randI + 1][h] != clearSea) { //проверяем клетку вниз
                        return generateShipCoords(map, countDeck);
                    }
                    //проверки если конец корабля
                    if (h == randJ + (countDeck - 1)) {
                        if (h + 1 <= 9 && randI + 1 <= 9 && map[randI + 1][h + 1] != clearSea) {//проверяем клетку вправо и вниз
                            return generateShipCoords(map, countDeck);
                        }
                        if (h + 1 <= 9 && map[randI][h + 1] != clearSea) {//проверяем клетку вправо
                            return generateShipCoords(map, countDeck);
                        }
                        if (h + 1 <= 9 && randI - 1 >= 0 && map[randI - 1][h + 1] != clearSea) {//проверяем клетку вправо и вверх
                            return generateShipCoords(map, countDeck);
                        }
                    }
                    var coord = {};
                    coord.i = randI;
                    coord.j = h;
                    coord.crashed = false;
                    coords.push(coord);
                }
            }
        }
        // если все ок -  добавляем на карту координаты корабля
        $.each(coords, function (index, value) {
            map[value.i][value.j] = ship;
        });
        return {coords: coords, pos: pos};
    }

    /**
     * Удар по клетке
     * @param i
     * @param j
     */
    function shoot(i, j) {
        var ship = findShip(i, j, isUserShoot);
        var map = isUserShoot ? compMap : userMap;
        var isHit = false;
        //если по координатам удара есть корабль
        if (!!ship) {
            //Проверка уничтожен ли корабль
            var countCrashed = 0;
            // пробегается по всем координатам корабль и
            // подсчитывается количество "убитых клеток" в т.ч. коорд удара
            $.each(ship.coords.coords, function (index, coord) {
                //если координаты удара найдены - на карте указывается что было попадание по кораблю
                if (coord.i == i && coord.j == j) {
                    coord.crashed = true;
                    map[i][j] = breakShip;
                }
                if (coord.crashed) {
                    countCrashed++;
                }
            });
            // если кол-во подбитых клеток корабля равно кол-во палуб - уничтожаем корабль
            if (countCrashed == ship.countDeck) {
                ship.crashed = true;
                crashShip(ship, map);
                // если бил компьютер - к списку успешных ударов добавляется удар
                // с указанием что он уничтожил корабль
                // (при следующем ударе компьютер не будет на него ориентироваться)
                if (!isUserShoot) {
                    compHits.push({i: i, j: j, shipCrash: true});
                }
            } else if (!isUserShoot) {
                compHits.push({i: i, j: j, shipCrash: false});
            }
            isHit = true;
        } else { // иначе просто указываем что удар был по морю
            map[i][j] = bombCrash;
        }
        redrawField(map, isUserShoot ? "compField" : "userField", !isUserShoot);
        checkWin(isUserShoot);
        //если бил игрок и не было попадания - бьет компьютер
        if (isUserShoot && !isHit) {
            computerTurn();
        }
        // Обновляем статистку
        refreshStatistic(true);
        refreshStatistic(false);
    }

    /**
     * Ход компьютера
     */
    function computerTurn() {
        $("#overlay-block-game").show(); //блокируем окно
        $('#compField').css('background-color', '#f2f2f2');
        setCompTurnText();
        //вызов удара в отд функции т.к. она вызывается рекурсивно
        computerShoot(false);
    }

    var holdCompTurn = false; // флаг удержания управления пока ходит комьютер
    var recurCounter = 0; // счетчик рекурсии, необходим для управления удержания управления

    /**
     * Удар компьютера
     * @param recur вызов производится рекурсивно
     */
    function computerShoot(recur) {
        setTimeout(function () {
            isUserShoot = false;

            var coordI = null;
            var coordJ = null;
            // получаем координаты удара на основе анализа последнего удара
            // если последний удар уничтожил корабль - берутся случайные координаты
            var linkedCoords = giveLinkedCoords();
            if (linkedCoords) {
                coordI = linkedCoords.i;
                coordJ = linkedCoords.j;
                findAndDeleteFromUserClearField(coordI, coordJ);
            } else {
                var userCoords = userClearField.pop();
                userClearField = Utils.shuffle(userClearField);
                coordI = userCoords.i;
                coordJ = userCoords.j;
            }
            shoot(coordI, coordJ);
            r = userMap[coordI][coordJ];
            var isHit = r == breakShip;
            if (isHit) {
                recurCounter++;
                computerShoot(true);
                holdCompTurn = true;
            } else {
                if (recur) {
                    recurCounter--;
                }
                if (recurCounter == 0) {
                    holdCompTurn = false;
                }
                if (!recur && recurCounter > 0) while (!holdCompTurn) {
                }
                isUserShoot = true;
                $("#overlay-block-game").hide();
                $('#compField').css('background-color', 'white');
                setUserTurnText();
            }
        }, 2000);
    }

    /**
     * Поиск и удаление из списка возможных ударов по координатам
     * @param i
     * @param j
     */
    function findAndDeleteFromUserClearField(i, j) {
        for (var n = 0; n < userClearField.length; n++) {
            if (userClearField[n].i == i && userClearField[n].j == j) {
                userClearField.splice(n, 1);
                break;
            }
        }
    }

    /**
     * Получение координат удара на основе анализа последних ударов
     * @returns {*}
     */
    function giveLinkedCoords() {
        var result;
        // если есть удары и последний удар не привел к уничтожению корабля
        if (compHits.length > 0 && !compHits[compHits.length - 1].shipCrash) {
            // запрашиваются последние удары по одному кораблю
            var linkedHits = giveLinkedHitsParams();
            //если он один - ищутся доступные координаты вокруг него
            if (linkedHits.hits.length == 1) {
                var hit = linkedHits.hits[0];
                result = giveResultCoords(hit, null, null)
            } else { //если есть удары по одному кораблю то с учетом его направления
                // запрашиваются координаты с начала корабля
                var beginHit = linkedHits.hits[0];
                result = giveResultCoords(beginHit, linkedHits.pos, true);
                if (!result) { // если начала недоступны для удара - запрашиваем координаты с конца корабля
                    var endHit = linkedHits.hits[linkedHits.hits.length - 1];
                    result = giveResultCoords(endHit, linkedHits.pos, false);
                }
            }
            return result;
        } else {
            return null;
        }
    }

    /**
     * Если положение горизонтальное - ищутся координаты справа или слева
     * Если положение вертикальное - ищутся координаты снизу или сверху
     * @param hit удар, вокруг которого надо искать доступные координаты
     * @param pos направление корабля, если пусто - координаты ищутся во всех направлениях
     * @param isBegin начало корабля? если пусто - координаты ищутся во всех направлениях
     * @returns {*} последние удары по одному кораблю
     */
    function giveResultCoords(hit, pos, isBegin) {
        var result = {i: null, j: null};
        if (
            (!pos || pos == 0) &&
            (isBegin == null || isBegin) &&
            hit.i - 1 >= 0 &&
            userMap[hit.i - 1][hit.j] != bombCrash &&
            userMap[hit.i - 1][hit.j] != breakShip
        ) {
            result.i = hit.i - 1;
            result.j = hit.j;
        } else if (
            (!pos || pos == 1) &&
            (isBegin == null || isBegin) &&
            hit.j - 1 >= 0 &&
            userMap[hit.i][hit.j - 1] != bombCrash &&
            userMap[hit.i][hit.j - 1] != breakShip
        ) {
            result.i = hit.i;
            result.j = hit.j - 1;
        } else if (
            (!pos || pos == 0) &&
            (isBegin == null || !isBegin) &&
            hit.i + 1 <= 9 &&
            userMap[hit.i + 1][hit.j] != bombCrash &&
            userMap[hit.i + 1][hit.j] != breakShip
        ) {
            result.i = hit.i + 1;
            result.j = hit.j;
        } else if (
            (!pos || pos == 1) &&
            (isBegin == null || !isBegin) &&
            hit.j + 1 <= 9 &&
            userMap[hit.i][hit.j + 1] != bombCrash &&
            userMap[hit.i][hit.j + 1] != breakShip
        ) {
            result.i = hit.i;
            result.j = hit.j + 1;
        } else {
            return null
        }
        return result;
    }

    /**
     * @returns {{hits: Array, pos: null}} последние удары по одному кораблю,
     * если удар один - то возвращается этот удар
     */
    function giveLinkedHitsParams() {
        var result = {hits: [], pos: null};
        var lastHit = compHits[compHits.length - 1];
        result.hits.push(lastHit);
        var i = 2;
        while (compHits.length - i >= 0) {
            // прохождение по ударам с конца в начало и проверка на сооответствие координат
            var lastLastHit = compHits[compHits.length - i];
            if (lastHit.j == lastLastHit.j) {
                if (lastHit.i - 1 == lastLastHit.i || lastHit.i + 1 == lastLastHit.i) {
                    result.hits.push(lastLastHit);
                    result.pos = 0;
                    lastHit = lastLastHit;
                }
                i++;
            } else if (lastHit.i == lastLastHit.i) {
                if (lastHit.j - 1 == lastLastHit.j || lastHit.j + 1 == lastLastHit.j) {
                    result.hits.push(lastLastHit);
                    result.pos = 1;
                    lastHit = lastLastHit;
                }
                i++;
            } else {
                break;
            }
        }
        if (result.hits.length > 1) {
            //сортировка координат по возрастанию
            result.hits.sort(function (a, b) {
                return (result.pos == 0 ? (a.i < b.i ? -1 : 1) : (a.j < b.j ? -1 : 1));
            });
        }
        return result;
    }

    /**
     * Уничтожение корабля - ставятся точки в радиусе 1 клетки вокруг корабля
     * @param ship
     * @param map
     */
    function crashShip(ship, map) {
        var pos = ship.coords.pos;
        $.each(ship.coords.coords, function (index, coord) {
            var i = coord.i;
            var j = coord.j;
            if (pos == 0) {
                if (index == 0) {
                    if (i - 1 >= 0) {
                        map[i - 1][j] = bombCrash;
                        //если удар компьютера - удаление координаты из списка возможных ударов
                        if (!isUserShoot) findAndDeleteFromUserClearField(i - 1, j);
                    }
                    if (i - 1 >= 0 && j - 1 >= 0) {
                        map[i - 1][j - 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i - 1, j - 1);
                    }
                    if (i - 1 >= 0 && j + 1 <= 9) {
                        map[i - 1][j + 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i - 1, j + 1);
                    }
                }
                if (j - 1 >= 0) {
                    map[i][j - 1] = bombCrash;
                    if (!isUserShoot)findAndDeleteFromUserClearField(i, j - 1);
                }
                if (j + 1 <= 9) {
                    map[i][j + 1] = bombCrash;
                    if (!isUserShoot)findAndDeleteFromUserClearField(i, j + 1);
                }
                if (index == ship.countDeck - 1) {
                    if (i + 1 <= 9) {
                        map[i + 1][j] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i + 1, j);
                    }
                    if (i + 1 <= 9 && j - 1 >= 0) {
                        map[i + 1][j - 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i + 1, j - 1);
                    }
                    if (i + 1 <= 9 && j + 1 <= 9) {
                        map[i + 1][j + 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i + 1, j + 1);
                    }
                }
            } else {
                if (index == 0) {
                    if (j - 1 >= 0) {
                        map[i][j - 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i, j - 1);
                    }
                    if (i - 1 >= 0 && j - 1 >= 0) {
                        map[i - 1][j - 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i - 1, j - 1);
                    }
                    if (i + 1 <= 9 && j - 1 >= 0) {
                        map[i + 1][j - 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i + 1, j - 1);
                    }
                }
                if (i - 1 >= 0) {
                    map[i - 1][j] = bombCrash;
                    if (!isUserShoot)findAndDeleteFromUserClearField(i - 1, j);
                }
                if (i + 1 <= 9) {
                    map[i + 1][j] = bombCrash;
                    if (!isUserShoot)findAndDeleteFromUserClearField(i + 1, j);
                }
                if (index == ship.countDeck - 1) {
                    if (j + 1 <= 9) {
                        map[i][j + 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i, j + 1);
                    }
                    if (i + 1 <= 9 && j + 1 <= 9) {
                        map[i + 1][j + 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i + 1, j + 1);
                    }
                    if (i - 1 >= 0 && j + 1 <= 9) {
                        map[i - 1][j + 1] = bombCrash;
                        if (!isUserShoot)findAndDeleteFromUserClearField(i - 1, j + 1);
                    }
                }
            }
        });
    }

    /**
     * Поиск корабля по заданным координатам
     * @param i
     * @param j
     * @param isUserShootVar
     * @returns {*}
     */
    function findShip(i, j, isUserShootVar) {
        var findedShip = null;
        $.each(isUserShootVar ? compShips : userShips, function (index, ship) {
            $.each(ship.coords.coords, function (index, coord) {
                if (coord.i == i && coord.j == j) {
                    findedShip = ship
                }
            });
        });
        return findedShip;
    }

    /**
     * Проверка на победу, если победа - выводим соответствующее окно
     * @param isUserShootVar удар игрока?
     */
    function checkWin(isUserShootVar) {
        var ships = isUserShootVar ? compShips : userShips;
        var countCrashedShip = 0;
        $.each(ships, function (index, ship) {
            if (ship.crashed) {
                countCrashedShip++;
            }
        });
        if (countCrashedShip == ships.length) {
            firstStart = true;
            $("#overlay-block-game").hide();
            $("#overlayText").empty().append(isUserShootVar ? "Вы выиграли" : "Вы проиграли");
            $(".overlay-game-over").show();
        }
    }

    /**
     * Генерация игровых полей
     */
    function generate() {
        reset();
        fillSea(userMap);
        fillSea(compMap);
        fillUsrClearField();
        userShips = generateShips(userMap);
        compShips = generateShips(compMap);
        redrawField(compMap, "compField", false);
        redrawField(userMap, "userField", true);
        refreshStatistic(true);
        refreshStatistic(false);
        firstStart = false;
    }

    /**
     * Сброс переменных
     */
    function reset() {
        userMap = [];
        compMap = [];
        isUserShoot = true;
        compHits = [];
        userClearField = [];
    }

    /**
     * Отображение окна задания именти игрока
     */
    function showUserNameDialog() {
        $(".overlay-game-over").hide();
        if (!firstStart && !confirm("Вы уверены?")) {
            return;
        }
        $(".overlay-user-name").show();
    }

    /**
     * Старт новой игры
     */
    function startGame() {
        if (checkName()) {
            $("#userNameErrorDiv").empty();
            $(".userNameInput").val("");
            $(".overlay-user-name").hide();
            $(".userNameSpan").empty().append(name);
            generate();
            setUserTurnText();
        }
    }

    function setCompTurnText() {
        $(".whoseTurnSpan").empty().append("Ход компьютера...");
    }

    function setUserTurnText() {
        $(".whoseTurnSpan").empty().append("Ваш ход!");
    }

    /**
     * Валидания имени
     * @returns {boolean}
     */
    function checkName() {
        var tempName = $(".userNameInput").val();
        if (!tempName) {
            $("#userNameErrorDiv").empty().append("<span class='userNameError'>Заполните поле</span>");
            return false;
        }
        name = tempName;
        return true;
    }

    /**
     * Обновление статистики
     * @param isUser
     */
    function refreshStatistic(isUser) {
        var fourDeck = 0;
        var threeDeck = 0;
        var twoDeck = 0;
        var oneDeck = 0;
        $.each(isUser ? userShips : compShips, function (index, ship) {
            if (ship.countDeck == 4 && !ship.crashed) {
                fourDeck++;
            }
            else if (ship.countDeck == 3 && !ship.crashed) {
                threeDeck++;
            }
            else if (ship.countDeck == 2 && !ship.crashed) {
                twoDeck++;
            }
            else if (ship.countDeck == 1 && !ship.crashed) {
                oneDeck++;
            }
        });
        $(".oneDeckSpan" + (!isUser ? "User" : "Comp")).empty().append(oneDeck);
        $(".twoDeckSpan" + (!isUser ? "User" : "Comp")).empty().append(twoDeck);
        $(".threeDeckSpan" + (!isUser ? "User" : "Comp")).empty().append(threeDeck);
        $(".fourDeckSpan" + (!isUser ? "User" : "Comp")).empty().append(fourDeck);
    }

    return {
        showUserNameDialog: showUserNameDialog,
        startGame: startGame,
        shoot: shoot
    };
})();