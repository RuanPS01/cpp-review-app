#include <iostream>
#include <iomanip>

using namespace std;
int main()
{
    double N, altura, maior = -999, menor = 3.0;
    
    cin >> N;
    for(int i = 0; i < N; i++){
        cin >> altura;
        if(altura > maior){
            maior = altura;
        }
        else if(altura < menor){
            menor = altura;
        }
    }
    
    
    cout << fixed << setprecision(2);
    cout << "Menor altura: " << menor << endl;
    cout << fixed << setprecision(2);
    cout << "Maior altura: " << maior << endl;
    
    
    
    
    
    return 0;
}