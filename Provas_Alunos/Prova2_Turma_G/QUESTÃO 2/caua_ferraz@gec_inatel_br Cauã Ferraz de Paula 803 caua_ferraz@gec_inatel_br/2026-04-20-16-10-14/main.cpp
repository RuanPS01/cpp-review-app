#include <iostream>
#include <iomanip>
#include <cstring>
#include <cmath>

using namespace std;

int main()
{
    int N; //qunatidade de numeros a serem inseridos
    cin >> N;
    
    int Numeros[N];
    double NumerosDecimais[N];
    double media = 0.0000;
    
    for(int i=0; i < N; i++)
    {
        cin >> Numeros[i];
        NumerosDecimais[i] = (Numeros[i] * 1.0000);
    }
    
    for(int i=0; i < N; i++)
    {
        media = media + NumerosDecimais[i];
    }
    
    media = media/N;
    
    cout << setprecision(4);
    cout << media;
    
    return 0;
}