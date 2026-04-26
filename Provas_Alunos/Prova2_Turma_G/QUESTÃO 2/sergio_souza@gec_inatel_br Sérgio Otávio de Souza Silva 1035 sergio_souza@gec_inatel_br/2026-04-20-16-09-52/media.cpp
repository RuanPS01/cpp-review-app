#include<iostream>
#include<iomanip>
using namespace std;

int main()
{
    int quantosNum;
    int numeros;
    double media;
    double soma = 0;
    
    cin >> quantosNum;
    
    for(int i = 0;i < quantosNum ;i++){
        cin >> numeros;
        soma = soma + numeros;
    }
    media = soma /quantosNum;
    cout << fixed << setprecision(4);
    cout << media;
    return 0;
}