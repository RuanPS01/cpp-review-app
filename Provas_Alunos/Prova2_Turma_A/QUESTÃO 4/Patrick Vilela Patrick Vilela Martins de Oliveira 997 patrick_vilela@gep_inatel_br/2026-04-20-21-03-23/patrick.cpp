#include <iostream>
#include <iomanip>
#include <cstring>
#include <cmath>

using namespace std;

int main()
{
    int N;
    int numeros[1000];
    char posneg[1000];
    int somaP = 0;
    int somaN = 0;
    double media = 0;
    int i = 0;
    while(N != 0)
    {
        cin >> N;
        strcpy(numeros, N);
        if (N > 0)
        {
            somaP = somaP + N;
        }
        if (N < 0)
        {
            somaN = somaN + N;
        }
        i++;
        if (N == 0)
        {
            i = i - 1;
        }
    }
    cin >> posneg;
    if (strcmp(posneg, "positivos") == 0)
    {
        media = somaP / i;
        cout << fixed << setprecision(3);
        cout << "media = " << media;
    }
    if (strcmp(posneg, "negativos") == 0)
    {
        media = somaN / i;
        cout << fixed << setprecision(3);
        cout << "media = " << media;
    }
    return 0;
}